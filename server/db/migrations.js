import { transaction } from './transaction.js';

export function migratePickupColumns(db) {
  const pickupColumns = new Set(
    db
      .prepare('PRAGMA table_info(pickups)')
      .all()
      .map((column) => column.name),
  );
  for (const [name, definition] of [
    ['transport_kind', "TEXT CHECK(transport_kind IN ('external','seller','buyer'))"],
    ['transport_company_id', 'INTEGER REFERENCES transport_companies(id)'],
    ['transport_assigned_by', 'INTEGER REFERENCES users(id)'],
    ['transport_assigned_at', 'TEXT'],
  ])
    if (!pickupColumns.has(name)) {
      db.exec(`ALTER TABLE pickups ADD COLUMN ${name} ${definition}`);
    }
}

export function migrateLegacyCarriers(db, demo) {
  // Preserve responsible companies previously recorded as free text.
  transaction(db, () => {
    const legacy = db
      .prepare(
        `SELECT p.id,p.carrier,o.city,o.state FROM pickups p JOIN trades t ON t.id=p.trade_id
      JOIN organizations o ON o.id=t.seller_id WHERE p.transport_kind IS NULL AND trim(p.carrier)!=''`,
      )
      .all();
    for (const pickup of legacy) {
      db.prepare(
        'INSERT OR IGNORE INTO transport_companies (name,city,state,is_demo) VALUES (?,?,?,?)',
      ).run(pickup.carrier, pickup.city, pickup.state, demo ? 1 : 0);
      const company = db
        .prepare('SELECT id FROM transport_companies WHERE name=?')
        .get(pickup.carrier);
      db.prepare(
        "UPDATE pickups SET transport_kind='external',transport_company_id=? WHERE id=?",
      ).run(company.id, pickup.id);
    }
  });
}
