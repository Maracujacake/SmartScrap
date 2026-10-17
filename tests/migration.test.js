import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { resolve, dirname, join, basename } from 'node:path';
import { createDatabase } from '../server/database.js';

test('migração preserva negócios existentes e relaciona transportadoras antigas sem duplicá-las', () => {
  const base = resolve('data');
  mkdirSync(base, { recursive: true });
  const directory = mkdtempSync(join(base, 'migration-test-'));
  const path = join(directory, 'legacy.sqlite');
  let db;
  try {
    db = createDatabase(path);
    const before = {
      lots: db.prepare('SELECT COUNT(*) AS n FROM lots').get().n,
      pickups: db.prepare('SELECT COUNT(*) AS n FROM pickups').get().n,
    };
    for (const column of [
      'transport_kind',
      'transport_company_id',
      'transport_assigned_by',
      'transport_assigned_at',
    ])
      db.exec(`ALTER TABLE pickups DROP COLUMN ${column}`);
    db.close();
    db = createDatabase(path);
    assert.equal(db.prepare('SELECT COUNT(*) AS n FROM lots').get().n, before.lots);
    assert.equal(db.prepare('SELECT COUNT(*) AS n FROM pickups').get().n, before.pickups);
    assert.equal(
      db
        .prepare("SELECT COUNT(*) AS n FROM pickups WHERE carrier!='' AND transport_kind IS NULL")
        .get().n,
      0,
    );
    const count = db.prepare('SELECT COUNT(*) AS n FROM transport_companies').get().n;
    db.close();
    db = createDatabase(path);
    assert.equal(db.prepare('SELECT COUNT(*) AS n FROM transport_companies').get().n, count);
    assert.equal(
      db
        .prepare(
          "SELECT COUNT(*) AS n FROM transport_companies WHERE name='Exemplo Transporters LTDA'",
        )
        .get().n,
      1,
    );
  } finally {
    db?.close();
    assert.equal(dirname(directory), base);
    assert.ok(basename(directory).startsWith('migration-test-'));
    rmSync(directory, { recursive: true, force: true });
  }
});

test('migração do tipo transportadora preserva organizações antigas, usuários e referências', () => {
  const base = resolve('data');
  const directory = mkdtempSync(join(base, 'migration-test-'));
  const path = join(directory, 'organizations.sqlite');
  let db;
  try {
    db = createDatabase(path, false);
    db.prepare(
      'INSERT INTO organizations(id,name,type,city,state,invite_code) VALUES (1,?,?,?,?,?)',
    ).run('Empresa antiga', 'company', 'Santos', 'SP', 'LEGACY');
    db.prepare(
      'INSERT INTO users(id,organization_id,name,email,password_hash) VALUES (1,1,?,?,?)',
    ).run('Pessoa antiga', 'legacy@example.test', 'hash-antigo');
    db.prepare(
      'INSERT INTO lots(id,organization_id,title,material,weight,price_cents,description,city,state,created_by) VALUES (1,1,?,?,?,?,?,?,?,1)',
    ).run('Lote antigo', 'Aço', 2, 125, 'Descrição antiga', 'Santos', 'SP');
    const sql = db.prepare("SELECT sql FROM sqlite_master WHERE name='organizations'").get().sql;
    db.exec('PRAGMA foreign_keys = OFF');
    db.exec(
      sql
        .replace('CREATE TABLE organizations', 'CREATE TABLE organizations_legacy')
        .replace("'company','ngo','carrier'", "'company','ngo'"),
    );
    db.exec(
      'INSERT INTO organizations_legacy SELECT * FROM organizations; DROP TABLE organizations; ALTER TABLE organizations_legacy RENAME TO organizations;',
    );
    db.close();
    db = createDatabase(path, false);
    assert.equal(
      db.prepare('SELECT name FROM organizations WHERE id=1').get().name,
      'Empresa antiga',
    );
    assert.equal(
      db.prepare('SELECT organization_id,password_hash FROM users WHERE id=1').get().password_hash,
      'hash-antigo',
    );
    assert.equal(
      db.prepare('SELECT organization_id FROM lots WHERE id=1').get().organization_id,
      1,
    );
    assert.equal(db.prepare('PRAGMA foreign_keys').get().foreign_keys, 1);
    assert.deepEqual(db.prepare('PRAGMA foreign_key_check').all(), []);
    db.prepare(
      'INSERT INTO organizations(name,type,city,state,invite_code) VALUES (?,?,?,?,?)',
    ).run('Transportadora nova', 'carrier', 'Santos', 'SP', 'NEW');
    db.close();
    db = createDatabase(path, false);
    assert.equal(db.prepare('SELECT COUNT(*) AS n FROM organizations').get().n, 2);
  } finally {
    db?.close();
    assert.equal(dirname(directory), base);
    assert.ok(basename(directory).startsWith('migration-test-'));
    rmSync(directory, { recursive: true, force: true });
  }
});
