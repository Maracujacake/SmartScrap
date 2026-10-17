import { transaction } from '../db/transaction.js';
import { fail } from '../validation.js';

export function createProposalService(db, notify, email) {
  function send(user, lotId, price, message) {
    if (user.organization_type === 'carrier')
      fail('Transportadoras gerenciam fretes e não enviam propostas de compra.', 403);
    transaction(db, () => {
      const lot = db.prepare('SELECT * FROM lots WHERE id=?').get(lotId);
      if (!lot) {
        fail('Lote não encontrado.', 404);
      }
      if (lot.organization_id === user.organization_id) {
        fail('Sua organização não pode enviar propostas para seus próprios lotes.');
      }
      if (lot.status === 'sold') {
        fail('Este lote já foi negociado.', 409);
      }
      if (
        db
          .prepare(
            "SELECT id FROM proposals WHERE lot_id=? AND organization_id=? AND status='pending'",
          )
          .get(lotId, user.organization_id)
      ) {
        fail('Sua organização já tem uma proposta em análise para este lote.', 409);
      }
      const proposalId = Number(
        db
          .prepare(
            'INSERT INTO proposals (lot_id,organization_id,created_by,price_cents,message) VALUES (?,?,?,?,?)',
          )
          .run(lotId, user.organization_id, user.id, price, message).lastInsertRowid,
      );
      db.prepare("UPDATE lots SET status='negotiating' WHERE id=?").run(lotId);
      notify.run(
        lot.organization_id,
        'Nova proposta recebida',
        `${user.organization_name} enviou uma proposta para ${lot.title}.`,
        lotId,
      );
      email.organization(
        lot.organization_id,
        `proposal:${proposalId}:received`,
        'Nova proposta para seu lote',
        `${user.organization_name} enviou uma proposta para "${lot.title}".\nOferta: ${(price / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} por kg.\n\nAcesse Propostas para avaliar.`,
      );
      email.enqueue(
        user.id,
        `proposal:${proposalId}:sent`,
        'Sua proposta foi enviada',
        `Sua proposta para "${lot.title}" foi registrada com sucesso.\nAcompanhe a resposta em Propostas enviadas.`,
      );
    });
  }

  function decide(user, proposalId, status) {
    transaction(db, () => {
      const proposal = db
        .prepare(
          'SELECT p.*,l.organization_id AS seller_id,l.status AS lot_status,l.title,l.weight FROM proposals p JOIN lots l ON l.id=p.lot_id WHERE p.id=?',
        )
        .get(proposalId);
      if (!proposal) {
        fail('Proposta não encontrada.', 404);
      }
      if (proposal.seller_id !== user.organization_id) {
        fail('Somente a organização vendedora pode avaliar esta proposta.', 403);
      }
      if (proposal.status !== 'pending' || proposal.lot_status === 'sold') {
        fail('Esta proposta já foi avaliada.', 409);
      }
      db.prepare('UPDATE proposals SET status=? WHERE id=?').run(status, proposalId);
      if (status === 'accepted') {
        const tradeId = Number(
          db
            .prepare(
              'INSERT INTO trades (lot_id,proposal_id,seller_id,buyer_id,total_cents) VALUES (?,?,?,?,?)',
            )
            .run(
              proposal.lot_id,
              proposalId,
              proposal.seller_id,
              proposal.organization_id,
              Math.round(proposal.weight * 1000 * proposal.price_cents),
            ).lastInsertRowid,
        );
        db.prepare('INSERT INTO pickups (trade_id) VALUES (?)').run(tradeId);
        db.prepare("UPDATE lots SET status='sold' WHERE id=?").run(proposal.lot_id);
        const other = db
          .prepare(
            "SELECT organization_id FROM proposals WHERE lot_id=? AND id!=? AND status='pending'",
          )
          .all(proposal.lot_id, proposalId);
        db.prepare(
          "UPDATE proposals SET status='rejected' WHERE lot_id=? AND id!=? AND status='pending'",
        ).run(proposal.lot_id, proposalId);
        other.forEach((p) =>
          notify.run(
            p.organization_id,
            'Lote negociado',
            `O lote ${proposal.title} foi negociado com outra organização.`,
            proposal.lot_id,
          ),
        );
        notify.run(
          proposal.seller_id,
          'Negociação concluída',
          `A venda de ${proposal.title} foi confirmada. Organize a coleta.`,
          proposal.lot_id,
        );
        notify.run(
          proposal.organization_id,
          'Sua proposta foi aceita',
          `A compra de ${proposal.title} foi confirmada. Organize a coleta.`,
          proposal.lot_id,
        );
      } else {
        if (
          !db
            .prepare("SELECT id FROM proposals WHERE lot_id=? AND status='pending'")
            .get(proposal.lot_id)
        ) {
          db.prepare("UPDATE lots SET status='available' WHERE id=?").run(proposal.lot_id);
        }
        notify.run(
          proposal.organization_id,
          'Proposta avaliada',
          `Sua proposta para ${proposal.title} não foi aceita. Você pode enviar uma nova oferta.`,
          proposal.lot_id,
        );
      }
    });
  }
  return { send, decide };
}
