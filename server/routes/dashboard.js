import { materials } from '../constants.js';
import { lotQuery, pickupQuery } from '../queries.js';

export function registerDashboardRoutes(app, { db }) {
  app.get('/api/dashboard', (req, res) => {
    if (req.user.organization_type === 'carrier')
      return res.status(403).json({ error: 'Use o painel de transporte.' });
    const orgId = req.user.organization_id;
    const days = [7, 30, 90, 365].includes(Number(req.query.days)) ? Number(req.query.days) : 30;
    const start = new Date(Date.now() - days * 86400000)
      .toISOString()
      .slice(0, 19)
      .replace('T', ' ');
    const previous = new Date(Date.now() - 2 * days * 86400000)
      .toISOString()
      .slice(0, 19)
      .replace('T', ' ');
    const trades = db
      .prepare(
        `SELECT t.*,l.weight,l.material FROM trades t JOIN lots l ON l.id=t.lot_id WHERE (t.seller_id=? OR t.buyer_id=?) AND t.created_at>=? ORDER BY t.created_at`,
      )
      .all(orgId, orgId, previous);
    const aggregate = (rows) => ({
      sold: rows.filter((t) => t.seller_id === orgId).reduce((s, t) => s + t.weight, 0),
      bought: rows.filter((t) => t.buyer_id === orgId).reduce((s, t) => s + t.weight, 0),
      value: rows.reduce((s, t) => s + t.total_cents, 0) / 100,
    });
    const currentTrades = trades.filter((t) => t.created_at >= start);
    const stats = aggregate(currentTrades);
    const prev = aggregate(trades.filter((t) => t.created_at < start));
    const active = db
      .prepare("SELECT COUNT(*) AS count FROM lots WHERE organization_id=? AND status!='sold'")
      .get(orgId).count;
    const pending = db
      .prepare(
        "SELECT COUNT(*) AS count FROM proposals p JOIN lots l ON l.id=p.lot_id WHERE l.organization_id=? AND p.status='pending'",
      )
      .get(orgId).count;
    const composition = materials
      .map((material) => ({
        material,
        weight: currentTrades
          .filter((t) => t.material === material && t.seller_id === orgId)
          .reduce((s, t) => s + t.weight, 0),
      }))
      .filter((m) => m.weight > 0);
    const chart = Array.from(
      {
        length: 8,
      },
      (_, i) => {
        const from = Date.now() - days * 86400000 + (i * days * 86400000) / 8;
        const to = from + (days * 86400000) / 8;
        const rows = currentTrades.filter((t) => {
          const time = Date.parse(t.created_at.replace(' ', 'T') + 'Z');
          return time >= from && time < to;
        });
        return {
          date: new Date(to).toISOString().slice(0, 10),
          ...aggregate(rows),
        };
      },
    );
    const lots = db
      .prepare(`${lotQuery} WHERE l.organization_id=? AND l.status!='sold' ORDER BY l.id LIMIT 5`)
      .all(orgId);
    const pickups = db
      .prepare(
        `${pickupQuery} WHERE (t.seller_id=? OR t.buyer_id=?) AND p.status!='delivered' ORDER BY p.scheduled_date LIMIT 3`,
      )
      .all(orgId, orgId);
    res.json({
      stats: {
        ...stats,
        active,
        pending,
      },
      previous: prev,
      composition,
      chart,
      lots,
      pickups,
      days,
    });
  });
}
