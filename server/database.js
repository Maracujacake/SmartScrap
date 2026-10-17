import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { initializeSchema } from './db/schema.js';
import { migratePickupColumns, migrateLegacyCarriers } from './db/migrations.js';
import { seed } from './db/seed.js';
import { migrateLogistics, seedCarrier } from './db/logistics.js';

export { hashPassword, verifyPassword } from './security/passwords.js';

export { transaction } from './db/transaction.js';

export function createDatabase(
  path = process.env.DB_PATH || resolve('data/smartscrap.sqlite'),
  demo = process.env.SEED_DEMO !== 'false',
) {
  if (path !== ':memory:') {
    mkdirSync(dirname(path), {
      recursive: true,
    });
  }
  const db = new DatabaseSync(path);
  initializeSchema(db);
  migratePickupColumns(db);
  migrateLogistics(db);
  if (demo && !db.prepare('SELECT id FROM organizations LIMIT 1').get()) {
    seed(db);
  }
  if (demo) {
    db.prepare(
      'INSERT OR IGNORE INTO transport_companies (name,city,state,is_demo) VALUES (?,?,?,1)',
    ).run('Exemplo Transporters LTDA', 'São Paulo', 'SP');
  }
  migrateLegacyCarriers(db, demo);
  if (demo) seedCarrier(db);
  return db;
}
