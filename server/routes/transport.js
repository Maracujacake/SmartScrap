import { materials } from '../constants.js';
import { fail } from '../validation.js';
import { transaction } from '../db/transaction.js';

export function registerTransportRoutes(app, { db }) {
  function ownCompany(user) {
    if (user.organization_type !== 'carrier') fail('Área exclusiva de transportadoras.', 403);
    const company = db
      .prepare('SELECT * FROM transport_companies WHERE organization_id=?')
      .get(user.organization_id);
    if (!company) fail('Cadastro da transportadora não encontrado.', 404);
    return company;
  }
  app.get('/api/transport/profile', (req, res) => {
    const company = ownCompany(req.user);
    const rates = db
      .prepare(
        'SELECT material,rate_micros,minimum_cents FROM transport_rates WHERE transport_company_id=?',
      )
      .all(company.id);
    res.json({
      company,
      rates: rates.map((rate) => ({
        material: rate.material,
        pricePerKgKm: rate.rate_micros / 1000000,
        minimumFreight: rate.minimum_cents / 100,
      })),
    });
  });
  app.put('/api/transport/rates', (req, res) => {
    const company = ownCompany(req.user);
    if (!Array.isArray(req.body?.rates) || req.body.rates.length > materials.length)
      fail('Envie as tarifas por metal.');
    const seen = new Set();
    const rates = req.body.rates.map((rate) => {
      if (!rate || !materials.includes(rate.material) || seen.has(rate.material))
        fail('Metal inválido ou duplicado.');
      seen.add(rate.material);
      const price = Number(rate.pricePerKgKm),
        minimum = Number(rate.minimumFreight ?? 0);
      if (
        !Number.isFinite(price) ||
        price < 0.000001 ||
        price > 100 ||
        Math.abs(price * 1000000 - Math.round(price * 1000000)) > 1e-7
      )
        fail('A tarifa deve ser de R$ 0,000001 a R$ 100 por kg/km, com até seis casas decimais.');
      if (
        !Number.isFinite(minimum) ||
        minimum < 0 ||
        minimum > 1000000 ||
        Math.abs(minimum * 100 - Math.round(minimum * 100)) > 1e-7
      )
        fail('Informe um frete mínimo de até R$ 1.000.000, com até duas casas decimais.');
      return {
        material: rate.material,
        micros: Math.round(price * 1000000),
        minimum: Math.round(minimum * 100),
      };
    });
    transaction(db, () => {
      db.prepare('DELETE FROM transport_rates WHERE transport_company_id=?').run(company.id);
      for (const rate of rates)
        db.prepare('INSERT INTO transport_rates VALUES (?,?,?,?)').run(
          company.id,
          rate.material,
          rate.micros,
          rate.minimum,
        );
    });
    res.json({ ok: true });
  });
  app.get('/api/transport/dashboard', (req, res) => {
    const company = ownCompany(req.user);
    const days = [7, 30, 90, 365].includes(Number(req.query.days)) ? Number(req.query.days) : 30;
    const start = new Date(Date.now() - days * 86400000).toISOString();
    const rows = db
      .prepare(
        `SELECT p.*,l.weight FROM pickups p JOIN trades t ON t.id=p.trade_id JOIN lots l ON l.id=t.lot_id
      WHERE p.transport_kind='external' AND p.transport_company_id=?`,
      )
      .all(company.id);
    const completed = rows.filter(
      (p) =>
        p.status === 'delivered' &&
        Date.parse(p.completed_at || p.updated_at.replace(' ', 'T') + 'Z') >= Date.parse(start),
    );
    res.json({
      days,
      stats: {
        transportedTonnes: completed.reduce((sum, p) => sum + p.weight, 0),
        deliveredLots: completed.length,
        completedFreightCents: completed.reduce((sum, p) => sum + p.freight_cents, 0),
        activeJobs: rows.filter((p) => p.status !== 'delivered').length,
        contractedFreightCents: rows
          .filter((p) => p.status !== 'delivered' && p.freight_confirmed_by)
          .reduce((sum, p) => sum + p.freight_cents, 0),
        distanceKm: completed.reduce((sum, p) => sum + (p.freight_distance_km || 0), 0),
      },
    });
  });
}
