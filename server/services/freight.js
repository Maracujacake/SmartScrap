import { createHash } from 'node:crypto';
import { fail, id } from '../validation.js';

export function quoteFreight(db, pickup, body) {
  const companyId = id(body.transportCompanyId);
  const company = db
    .prepare('SELECT id,name,organization_id FROM transport_companies WHERE id=? AND active=1')
    .get(companyId);
  if (!company) fail('Transportadora não encontrada ou indisponível.');
  const rate = db
    .prepare('SELECT * FROM transport_rates WHERE transport_company_id=? AND material=?')
    .get(companyId, pickup.material);
  if (!rate) fail('Esta transportadora ainda não cadastrou tarifa para este metal.');
  const distance = Number(body.distanceKm);
  if (
    !Number.isFinite(distance) ||
    distance <= 0 ||
    distance > 20000 ||
    Math.abs(distance * 10 - Math.round(distance * 10)) > 1e-7
  )
    fail('Informe a distância entre 0,1 e 20.000 km, com até uma casa decimal.');
  if (!['seller', 'buyer'].includes(body.freightPayer)) fail('Escolha quem pagará o frete.');
  // Integer arithmetic retains six decimal places in R$/kg/km. Round only the
  // resulting freight to cents; kilograms and kilometres are represented as g/m.
  const grams = BigInt(Math.round(pickup.weight * 1000000));
  const meters = BigInt(Math.round(distance * 1000));
  const numerator = grams * meters * BigInt(rate.rate_micros);
  const calculatedCents = Number((numerator + 5000000000n) / 10000000000n);
  const freightCents = Math.max(rate.minimum_cents, calculatedCents);
  const finalTotalCents = pickup.total_cents + freightCents;
  if (!Number.isSafeInteger(finalTotalCents) || finalTotalCents > 1000000000000000)
    fail('O valor calculado excede o limite permitido. Revise peso, distância e tarifa.');
  const quote = {
    pickupId: pickup.id,
    transportCompanyId: company.id,
    carrier: company.name,
    material: pickup.material,
    weightKg: pickup.weight * 1000,
    distanceKm: distance,
    rateMicros: rate.rate_micros,
    pricePerKgKm: rate.rate_micros / 1000000,
    minimumCents: rate.minimum_cents,
    materialCents: pickup.total_cents,
    freightCents,
    finalTotalCents,
    freightPayer: body.freightPayer,
  };
  return { ...quote, quoteToken: createHash('sha256').update(JSON.stringify(quote)).digest('hex') };
}
