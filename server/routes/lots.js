import { fail, string, money, id } from '../validation.js';
import { transaction } from '../database.js';
import { materials } from '../constants.js';
import { lotQuery, pickupQuery } from '../queries.js';

export function registerLotRoutes(app, { db, visual, email }) {
  app.get('/api/lots', (req, res) => {
    if (req.user.organization_type === 'carrier')
      fail('Transportadoras consultam apenas os lotes dos seus fretes.', 403);
    const clauses = [];
    const values = [];
    if (req.query.scope === 'mine') {
      clauses.push('l.organization_id=?');
      values.push(req.user.organization_id);
    } else {
      clauses.push("l.status!='sold'");
      clauses.push('l.organization_id!=?');
      values.push(req.user.organization_id);
    }
    if (req.query.company) {
      clauses.push('l.organization_id=?');
      values.push(id(req.query.company));
    }
    if (req.query.material && materials.includes(req.query.material)) {
      clauses.push('l.material=?');
      values.push(req.query.material);
    }
    if (req.query.status && ['available', 'negotiating', 'sold'].includes(req.query.status)) {
      clauses.push('l.status=?');
      values.push(req.query.status);
    }
    if (req.query.q) {
      clauses.push('(l.title LIKE ? OR o.name LIKE ? OR l.material LIKE ?)');
      const term = `%${String(req.query.q).slice(0, 120)}%`;
      values.push(term, term, term);
    }
    const lots = db
      .prepare(`${lotQuery} WHERE ${clauses.join(' AND ')} ORDER BY l.id DESC`)
      .all(...values);
    res.json({
      lots,
    });
  });
  app.get('/api/lots/:id', (req, res) => {
    const lot = db.prepare(`${lotQuery} WHERE l.id=?`).get(id(req.params.id));
    if (!lot) {
      fail('Lote não encontrado.', 404);
    }
    if (
      req.user.organization_type === 'carrier' &&
      !db
        .prepare(
          `SELECT p.id FROM pickups p JOIN trades t ON t.id=p.trade_id JOIN transport_companies tc ON tc.id=p.transport_company_id WHERE t.lot_id=? AND p.transport_kind='external' AND tc.organization_id=?`,
        )
        .get(lot.id, req.user.organization_id)
    )
      fail('Este lote não pertence a um frete da sua transportadora.', 403);
    const owned = lot.organization_id === req.user.organization_id;
    const pickup = db.prepare(`${pickupQuery} WHERE t.lot_id=?`).get(lot.id);
    const canSeeFreight =
      pickup &&
      [pickup.seller_id, pickup.buyer_id, pickup.carrier_organization_id].includes(
        req.user.organization_id,
      );
    const proposals = db
      .prepare(
        `SELECT p.*,o.name AS organization_name,o.type AS organization_type FROM proposals p JOIN organizations o ON o.id=p.organization_id WHERE p.lot_id=? ${owned ? '' : 'AND p.organization_id=?'} ORDER BY p.id DESC`,
      )
      .all(...(owned ? [lot.id] : [lot.id, req.user.organization_id]));
    res.json({
      lot,
      proposals,
      visualAnalysis: visual.forLot(req.user, lot.id),
      pickup: canSeeFreight ? pickup : null,
    });
  });
  app.post('/api/lots', (req, res) => {
    if (req.user.organization_type === 'carrier')
      fail('Transportadoras gerenciam fretes e não publicam lotes.', 403);
    const title = string(req.body.title, 'Título', 4, 120);
    const material = req.body.material;
    if (!materials.includes(material)) {
      fail('Selecione um material válido.');
    }
    const weight = Number(req.body.weight);
    if (!Number.isFinite(weight) || weight < 0.001 || weight > 100000) {
      fail('Informe o peso entre 0,001 e 100.000 toneladas.');
    }
    const price = money(req.body.price);
    const description = string(req.body.description, 'Descrição', 10, 2000);
    const lotId = transaction(db, () => {
      const validated = visual.validateLink(req.user, req.body);
      const created = Number(
        db
          .prepare(
            'INSERT INTO lots (organization_id,title,material,weight,price_cents,quality,description,city,state,created_by) VALUES (?,?,?,?,?,?,?,?,?,?)',
          )
          .run(
            req.user.organization_id,
            title,
            material,
            weight,
            price,
            '',
            description,
            req.user.city,
            req.user.state,
            req.user.id,
          ).lastInsertRowid,
      );
      visual.link(req.user, created, validated);
      email.enqueue(
        req.user.id,
        `lot:${created}`,
        'Seu lote foi publicado no SmartScrap',
        `Olá, ${req.user.name}.\n\nO lote "${title}" foi publicado com sucesso em nome de ${req.user.organization_name}.\nMaterial: ${material}\nPeso: ${weight} ${weight === 1 ? 'tonelada' : 'toneladas'}\n\nAcompanhe as propostas na plataforma.`,
      );
      return created;
    });
    res.status(201).json({
      lot: db.prepare(`${lotQuery} WHERE l.id=?`).get(lotId),
    });
  });
}
