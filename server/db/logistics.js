import { transaction } from './transaction.js';
import { hashPassword } from '../security/passwords.js';
import { materials } from '../constants.js';

export function migrateLogistics(db) {
  const organizationSql = db
    .prepare("SELECT sql FROM sqlite_master WHERE name='organizations'")
    .get().sql;
  if (!organizationSql.includes("'carrier'")) {
    // Rebuild only this CHECK constraint, preserving IDs and every existing relationship.
    db.exec('PRAGMA foreign_keys = OFF');
    try {
      transaction(db, () => {
        db.exec(`CREATE TABLE organizations_next (
          id INTEGER PRIMARY KEY, name TEXT NOT NULL, type TEXT NOT NULL CHECK(type IN ('company','ngo','carrier')),
          city TEXT NOT NULL, state TEXT NOT NULL, sector TEXT NOT NULL DEFAULT '', description TEXT NOT NULL DEFAULT '',
          invite_code TEXT NOT NULL UNIQUE, created_at TEXT NOT NULL DEFAULT (datetime('now'))
        );
        INSERT INTO organizations_next SELECT * FROM organizations;
        DROP TABLE organizations;
        ALTER TABLE organizations_next RENAME TO organizations;`);
        if (db.prepare('PRAGMA foreign_key_check').all().length)
          throw new Error('Migração de organizações inconsistente.');
      });
    } finally {
      db.exec('PRAGMA foreign_keys = ON');
    }
  }
  const companyColumns = new Set(
    db
      .prepare('PRAGMA table_info(transport_companies)')
      .all()
      .map((c) => c.name),
  );
  if (!companyColumns.has('organization_id'))
    db.exec(
      'ALTER TABLE transport_companies ADD COLUMN organization_id INTEGER REFERENCES organizations(id)',
    );
  db.exec(
    'CREATE UNIQUE INDEX IF NOT EXISTS transport_organization ON transport_companies(organization_id) WHERE organization_id IS NOT NULL',
  );
  const pickupColumns = new Set(
    db
      .prepare('PRAGMA table_info(pickups)')
      .all()
      .map((c) => c.name),
  );
  for (const [name, definition] of [
    ['freight_distance_km', 'REAL'],
    ['freight_rate_micros', 'INTEGER'],
    ['freight_minimum_cents', 'INTEGER NOT NULL DEFAULT 0'],
    ['freight_cents', 'INTEGER NOT NULL DEFAULT 0 CHECK(freight_cents>=0)'],
    ['freight_payer', "TEXT CHECK(freight_payer IN ('seller','buyer'))"],
    ['freight_confirmed_by', 'INTEGER REFERENCES users(id)'],
    ['freight_confirmed_at', 'TEXT'],
    ['completed_at', 'TEXT'],
  ])
    if (!pickupColumns.has(name)) db.exec(`ALTER TABLE pickups ADD COLUMN ${name} ${definition}`);
  db.exec(`CREATE TABLE IF NOT EXISTS transport_rates (
      transport_company_id INTEGER NOT NULL REFERENCES transport_companies(id), material TEXT NOT NULL,
      rate_micros INTEGER NOT NULL CHECK(rate_micros>0), minimum_cents INTEGER NOT NULL DEFAULT 0 CHECK(minimum_cents>=0),
      PRIMARY KEY(transport_company_id,material)
    );
    CREATE TABLE IF NOT EXISTS email_outbox (
      id INTEGER PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES users(id), event_key TEXT NOT NULL,
      recipient TEXT NOT NULL, subject TEXT NOT NULL, body TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','sending','sent','failed')),
      attempts INTEGER NOT NULL DEFAULT 0, next_attempt_at INTEGER NOT NULL DEFAULT 0,
      error TEXT, created_at TEXT NOT NULL DEFAULT (datetime('now')), sent_at TEXT,
      UNIQUE(event_key,user_id)
    );
    CREATE INDEX IF NOT EXISTS email_delivery ON email_outbox(status,next_attempt_at);`);
}

export function seedCarrier(db) {
  const company = db
    .prepare(
      "SELECT * FROM transport_companies WHERE name='Exemplo Transporters LTDA' AND is_demo=1",
    )
    .get();
  if (!company || company.organization_id) return;
  transaction(db, () => {
    const organizationId = Number(
      db
        .prepare(
          'INSERT INTO organizations(name,type,city,state,sector,invite_code) VALUES (?,?,?,?,?,?)',
        )
        .run(
          company.name,
          'carrier',
          company.city,
          company.state,
          'Transporte de metais',
          'TRANSPORTE-DEMO',
        ).lastInsertRowid,
    );
    db.prepare('UPDATE transport_companies SET organization_id=? WHERE id=?').run(
      organizationId,
      company.id,
    );
    db.prepare('INSERT INTO users(organization_id,name,email,password_hash) VALUES (?,?,?,?)').run(
      organizationId,
      'Carla Transportes',
      'carla@transportes.example',
      hashPassword('Demo@123'),
    );
    for (const material of materials)
      db.prepare('INSERT INTO transport_rates VALUES (?,?,?,?)').run(
        company.id,
        material,
        200,
        15000,
      );
  });
}
