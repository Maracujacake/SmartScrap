import { transaction } from '../db/transaction.js';
import { fail, id } from '../validation.js';
import { pickupQuery } from '../queries.js';
import { quoteFreight } from './freight.js';

export function createPickupService(db, notify) {
  function update(user, pickupId, body) {
    transaction(db, () => {
      const pickup = db.prepare(`${pickupQuery} WHERE p.id=?`).get(id(pickupId));
      if (!pickup) {
        fail('Coleta não encontrada.', 404);
      }
      const participant = [pickup.seller_id, pickup.buyer_id].includes(user.organization_id);
      const carrierMember =
        pickup.transport_kind === 'external' &&
        pickup.carrier_organization_id === user.organization_id;
      if (!participant && !carrierMember) {
        fail('Você não participa desta negociação.', 403);
      }
      const assigning = body.transportKind !== undefined;
      const changingStatus = body.status !== undefined;
      const pricing = ['distanceKm', 'freightPayer', 'confirmFreight', 'quoteToken'].some(
        (key) => body[key] !== undefined,
      );
      if (carrierMember && (assigning || pricing))
        fail('Somente vendedor ou comprador pode escolher a logística e confirmar o frete.', 403);
      if (!assigning && !changingStatus && !pricing) {
        fail('Escolha o responsável pelo transporte ou a próxima etapa.');
      }
      if ((assigning || pricing) && !['awaiting', 'scheduled'].includes(pickup.status)) {
        fail('O responsável só pode ser alterado antes de iniciar o transporte.', 409);
      }
      const next = changingStatus
        ? {
            awaiting: 'scheduled',
            scheduled: 'transit',
            transit: 'delivered',
          }[pickup.status]
        : pickup.status;
      if (changingStatus && (!next || body.status !== next)) {
        fail('Atualização inválida. Siga as etapas da coleta.', 409);
      }
      let kind = pickup.transport_kind;
      let companyId = pickup.transport_company_id;
      let carrier = pickup.carrier;
      let distance = pickup.freight_distance_km,
        rate = pickup.freight_rate_micros;
      let minimum = pickup.freight_minimum_cents,
        freight = pickup.freight_cents;
      let payer = pickup.freight_payer,
        confirmedBy = pickup.freight_confirmed_by,
        confirmedAt = pickup.freight_confirmed_at;
      if (assigning) {
        kind = body.transportKind;
        if (!['external', 'seller', 'buyer'].includes(kind)) {
          fail('Escolha uma transportadora ou uma das organizações da negociação.');
        }
        if (kind === 'external') {
          const company = db
            .prepare('SELECT id,name FROM transport_companies WHERE id=? AND active=1')
            .get(id(body.transportCompanyId));
          if (!company) {
            fail('Transportadora não encontrada ou indisponível.');
          }
          companyId = company.id;
          carrier = company.name;
        } else {
          companyId = null;
          carrier = kind === 'seller' ? pickup.seller_name : pickup.buyer_name;
        }
      }
      if (kind !== pickup.transport_kind || companyId !== pickup.transport_company_id) {
        distance = null;
        rate = null;
        minimum = 0;
        freight = 0;
        payer = null;
        confirmedBy = null;
        confirmedAt = null;
      }
      if (pricing) {
        if (kind !== 'external')
          fail('O orçamento de frete exige uma transportadora terceirizada.');
        const quote = quoteFreight(db, pickup, { ...body, transportCompanyId: companyId });
        if (body.confirmFreight !== true) fail('Confirme o valor do frete para continuar.');
        if (body.quoteToken !== quote.quoteToken)
          fail('O orçamento mudou. Atualize a estimativa e confirme novamente.', 409);
        distance = quote.distanceKm;
        rate = quote.rateMicros;
        minimum = quote.minimumCents;
        freight = quote.freightCents;
        payer = quote.freightPayer;
        confirmedBy = user.id;
        confirmedAt = new Date().toISOString();
      }
      if (changingStatus && ['scheduled', 'transit'].includes(next) && !kind) {
        fail('Associe uma empresa responsável antes de agendar ou iniciar o transporte.');
      }
      if (
        kind === 'external' &&
        ['scheduled', 'transit'].includes(next) &&
        !db.prepare('SELECT id FROM transport_companies WHERE id=? AND active=1').get(companyId)
      ) {
        fail('Escolha uma transportadora disponível antes de iniciar a coleta.');
      }
      if (
        changingStatus &&
        ['scheduled', 'transit'].includes(next) &&
        kind === 'external' &&
        !confirmedBy
      )
        fail('Confirme o orçamento do frete antes de agendar ou iniciar o transporte.');
      if (pickup.status === 'scheduled' && kind === 'external' && !confirmedBy)
        fail('Confirme o novo frete antes de alterar a transportadora de uma coleta agendada.');
      const date = body.scheduledDate ?? pickup.scheduled_date;
      if (body.scheduledDate !== undefined || (changingStatus && next === 'scheduled')) {
        if (
          !/^\d{4}-\d{2}-\d{2}$/.test(date || '') ||
          !Number.isFinite(Date.parse(`${date}T12:00:00Z`)) ||
          new Date(`${date}T12:00:00Z`).toISOString().slice(0, 10) !== date ||
          (changingStatus &&
            next === 'scheduled' &&
            date < new Date().toLocaleDateString('sv-SE', { timeZone: 'America/Sao_Paulo' }))
        ) {
          fail('Escolha uma data válida a partir de hoje.');
        }
      }
      db.prepare(
        "UPDATE pickups SET status=?,scheduled_date=?,carrier=?,transport_kind=?,transport_company_id=?,transport_assigned_by=?,transport_assigned_at=?,freight_distance_km=?,freight_rate_micros=?,freight_minimum_cents=?,freight_cents=?,freight_payer=?,freight_confirmed_by=?,freight_confirmed_at=?,completed_at=?,updated_at=datetime('now') WHERE id=?",
      ).run(
        next,
        date,
        carrier,
        kind,
        companyId,
        assigning ? user.id : pickup.transport_assigned_by,
        assigning ? new Date().toISOString() : pickup.transport_assigned_at,
        distance,
        rate,
        minimum,
        freight,
        payer,
        confirmedBy,
        confirmedAt,
        next === 'delivered' ? new Date().toISOString() : pickup.completed_at,
        pickup.id,
      );
      const label = changingStatus
        ? {
            scheduled: 'Coleta agendada',
            transit: 'Material em transporte',
            delivered: 'Entrega concluída',
          }[next]
        : pricing
          ? 'Frete confirmado'
          : 'Responsável pelo transporte definido';
      const carrierOrg =
        kind === 'external'
          ? db.prepare('SELECT organization_id FROM transport_companies WHERE id=?').get(companyId)
              ?.organization_id
          : null;
      [...new Set([pickup.seller_id, pickup.buyer_id, carrierOrg].filter(Boolean))].forEach((org) =>
        notify.run(
          org,
          label,
          `${pickup.title}: ${changingStatus ? label.toLowerCase() : carrier}.`,
          pickup.lot_id,
        ),
      );
    });
  }
  return { update };
}
