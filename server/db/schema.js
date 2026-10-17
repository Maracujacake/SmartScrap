export function initializeSchema(db) {
  db.exec(`
    PRAGMA foreign_keys = ON;
    PRAGMA journal_mode = WAL;
    PRAGMA busy_timeout = 5000;
    CREATE TABLE IF NOT EXISTS organizations (
      id INTEGER PRIMARY KEY, name TEXT NOT NULL, type TEXT NOT NULL CHECK(type IN ('company','ngo','carrier')),
      city TEXT NOT NULL, state TEXT NOT NULL, sector TEXT NOT NULL DEFAULT '', description TEXT NOT NULL DEFAULT '',
      invite_code TEXT NOT NULL UNIQUE, created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY, organization_id INTEGER NOT NULL REFERENCES organizations(id),
      name TEXT NOT NULL, email TEXT NOT NULL UNIQUE COLLATE NOCASE, password_hash TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS sessions (
      token TEXT PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES users(id), expires_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS lots (
      id INTEGER PRIMARY KEY, organization_id INTEGER NOT NULL REFERENCES organizations(id),
      title TEXT NOT NULL, material TEXT NOT NULL, weight REAL NOT NULL CHECK(weight > 0),
      price_cents INTEGER NOT NULL CHECK(price_cents > 0), quality TEXT NOT NULL DEFAULT '', description TEXT NOT NULL,
      city TEXT NOT NULL, state TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'available'
        CHECK(status IN ('available','negotiating','sold')),
      created_by INTEGER NOT NULL REFERENCES users(id), created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS proposals (
      id INTEGER PRIMARY KEY, lot_id INTEGER NOT NULL REFERENCES lots(id),
      organization_id INTEGER NOT NULL REFERENCES organizations(id), created_by INTEGER NOT NULL REFERENCES users(id),
      price_cents INTEGER NOT NULL CHECK(price_cents > 0), message TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','accepted','rejected')),
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE UNIQUE INDEX IF NOT EXISTS one_pending_proposal ON proposals(lot_id, organization_id) WHERE status = 'pending';
    CREATE TABLE IF NOT EXISTS trades (
      id INTEGER PRIMARY KEY, lot_id INTEGER NOT NULL UNIQUE REFERENCES lots(id),
      proposal_id INTEGER NOT NULL UNIQUE REFERENCES proposals(id), seller_id INTEGER NOT NULL REFERENCES organizations(id),
      buyer_id INTEGER NOT NULL REFERENCES organizations(id), total_cents INTEGER NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS transport_companies (
      id INTEGER PRIMARY KEY, name TEXT NOT NULL UNIQUE, city TEXT NOT NULL, state TEXT NOT NULL,
      is_demo INTEGER NOT NULL DEFAULT 0 CHECK(is_demo IN (0,1)), active INTEGER NOT NULL DEFAULT 1 CHECK(active IN (0,1)),
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS pickups (
      id INTEGER PRIMARY KEY, trade_id INTEGER NOT NULL UNIQUE REFERENCES trades(id),
      status TEXT NOT NULL DEFAULT 'awaiting' CHECK(status IN ('awaiting','scheduled','transit','delivered')),
      scheduled_date TEXT, carrier TEXT NOT NULL DEFAULT '', updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS notifications (
      id INTEGER PRIMARY KEY, organization_id INTEGER NOT NULL REFERENCES organizations(id),
      title TEXT NOT NULL, message TEXT NOT NULL, lot_id INTEGER REFERENCES lots(id),
      is_read INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS lots_organization ON lots(organization_id);
    CREATE INDEX IF NOT EXISTS notifications_organization ON notifications(organization_id);
    CREATE TABLE IF NOT EXISTS visual_analyses (
      id TEXT PRIMARY KEY, organization_id INTEGER NOT NULL REFERENCES organizations(id),
      created_by INTEGER NOT NULL REFERENCES users(id), material TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'uploading' CHECK(status IN ('uploading','queued','processing','completed','failed')),
      photo_count INTEGER NOT NULL CHECK(photo_count BETWEEN 1 AND 3), result_json TEXT, error TEXT,
      lot_id INTEGER UNIQUE REFERENCES lots(id), operator_verdict TEXT CHECK(operator_verdict IN ('agree','disagree','not_applicable')),
      operator_notes TEXT NOT NULL DEFAULT '', reviewed_by INTEGER REFERENCES users(id),
      created_at TEXT NOT NULL DEFAULT (datetime('now')), updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS visual_photos (
      analysis_id TEXT NOT NULL REFERENCES visual_analyses(id) ON DELETE CASCADE,
      position INTEGER NOT NULL CHECK(position BETWEEN 0 AND 2), original_name TEXT NOT NULL,
      uploaded INTEGER NOT NULL DEFAULT 0 CHECK(uploaded IN (-1,0,1)), bytes INTEGER NOT NULL DEFAULT 0,
      PRIMARY KEY (analysis_id,position)
    );
    CREATE INDEX IF NOT EXISTS visual_analyses_organization ON visual_analyses(organization_id);
  `);
}
