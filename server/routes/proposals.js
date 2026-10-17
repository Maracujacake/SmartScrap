import { fail, string, money, id } from '../validation.js';
import { createProposalService } from '../services/proposal.js';

export function registerProposalRoutes(app, { db, notify, email }) {
  const service = createProposalService(db, notify, email);

  app.post('/api/lots/:id/proposals', (req, res) => {
    const lotId = id(req.params.id);
    const price = money(req.body.price);
    const message = req.body.message ? string(req.body.message, 'Mensagem', 1, 1000) : '';
    service.send(req.user, lotId, price, message);
    res.status(201).json({
      ok: true,
    });
  });
  app.get('/api/proposals', (req, res) => {
    if (req.user.organization_type === 'carrier')
      fail('Transportadoras não participam das propostas de compra.', 403);
    const received = req.query.direction !== 'sent';
    const proposals = db
      .prepare(
        `SELECT p.*,l.title,l.material,l.weight,l.organization_id AS seller_id,o.name AS organization_name,
      s.name AS seller_name FROM proposals p JOIN lots l ON l.id=p.lot_id JOIN organizations o ON o.id=p.organization_id
      JOIN organizations s ON s.id=l.organization_id WHERE ${received ? 'l.organization_id' : 'p.organization_id'}=? ORDER BY p.id DESC`,
      )
      .all(req.user.organization_id);
    res.json({
      proposals,
    });
  });
  app.patch('/api/proposals/:id', (req, res) => {
    const proposalId = id(req.params.id);
    const status = req.body.status;
    if (!['accepted', 'rejected'].includes(status)) {
      fail('Ação inválida.');
    }
    service.decide(req.user, proposalId, status);
    res.json({
      ok: true,
    });
  });
}
