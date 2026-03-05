const Database = require('better-sqlite3');
const path = require('path');

const DB_PATH = path.join(__dirname, '..', 'confessional.db');

let db;

function getDb() {
  if (!db) {
    db = new Database(DB_PATH);
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
    console.log(`[DB] Connected to SQLite database at ${DB_PATH}`);
  }
  return db;
}

function initializeSchema() {
  const db = getDb();

  db.exec(`
    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      agent_id TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now')),
      status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'closed'))
    );

    CREATE TABLE IF NOT EXISTS confessions (
      id TEXT PRIMARY KEY,
      text TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now')),
      session_hash TEXT NOT NULL UNIQUE,
      flagged INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS session_attempts (
      session_hash TEXT PRIMARY KEY,
      attempted_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS admin_actions (
      id TEXT PRIMARY KEY,
      action TEXT NOT NULL CHECK (action IN ('flag', 'unflag', 'delete')),
      confession_id TEXT,
      admin_key_prefix TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now')),
      note TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_confessions_created_at_id ON confessions(created_at DESC, id DESC);
    CREATE INDEX IF NOT EXISTS idx_sessions_agent_id ON sessions(agent_id);
    CREATE INDEX IF NOT EXISTS idx_admin_actions_created_at ON admin_actions(created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_admin_actions_confession_id ON admin_actions(confession_id);
  `);

  console.log('[DB] Schema initialized successfully');
}

function closeDb() {
  if (db) {
    db.close();
    db = null;
    console.log('[DB] Database connection closed');
  }
}

module.exports = { getDb, initializeSchema, closeDb };
