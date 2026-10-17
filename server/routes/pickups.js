import { createPickupService } from '../services/pickup.js';
import { pickupQuery } from '../queries.js';
import { fail, id } from '../validation.js';
import { quoteFreight } from '../services/freight.js';

export function registerPickupRoutes(app, { db, notify }) {
  const service = createPickupService(db, notify);

  app.get('/api/pickups', (req, res) =>
    res.json({
      pickups: db
        .prepare(
          `${pickupQuery} WHERE t.seller_id=? OR t.buyer_id=? OR (p.transport_kind='external' AND tc.organization_id=?) ORDER BY CASE WHEN p.status='delivered' THEN 1 ELSE 0 END,p.scheduled_date,p.id DESC`,
        )
        .all(req.user.organization_id, req.user.organization_id, req.user.organization_id),
    }),
  );
  app.post('/api/pickups/:id/freight-quote', (req, res) => {
    const pickup = db.prepare(`${pickupQuery} WHERE p.id=?`).get(id(req.params.id));
    if (!pickup) fail('Coleta não encontrada.', 404);
    if (![pickup.seller_id, pickup.buyer_id].includes(req.user.organization_id))
      fail('Você não participa desta negociação.', 403);
    if (!['awaiting', 'scheduled'].includes(pickup.status))
      fail('O frete não pode ser alterado após iniciar o transporte.', 409);
    res.json({ quote: quoteFreight(db, pickup, req.body) });
  });
  app.patch('/api/pickups/:id', (req, res) => {
    service.update(req.user, req.params.id, req.body);
    res.json({
      ok: true,
    });
  });
}
