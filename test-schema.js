const db = require('better-sqlite3')('confessional.db', { readonly: true });

// List all tables
const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name").all();
console.log('TABLES:', JSON.stringify(tables, null, 2));

// List all indexes
const indexes = db.prepare("SELECT name, tbl_name FROM sqlite_master WHERE type='index' AND name NOT LIKE 'sqlite_%' ORDER BY name").all();
console.log('INDEXES:', JSON.stringify(indexes, null, 2));

// Check sessions schema
const sessionsInfo = db.prepare("PRAGMA table_info(sessions)").all();
console.log('SESSIONS SCHEMA:', JSON.stringify(sessionsInfo, null, 2));

// Check confessions schema
const confessionsInfo = db.prepare("PRAGMA table_info(confessions)").all();
console.log('CONFESSIONS SCHEMA:', JSON.stringify(confessionsInfo, null, 2));

// Check session_attempts schema
const attemptsInfo = db.prepare("PRAGMA table_info(session_attempts)").all();
console.log('SESSION_ATTEMPTS SCHEMA:', JSON.stringify(attemptsInfo, null, 2));

// Check admin_actions schema
const adminInfo = db.prepare("PRAGMA table_info(admin_actions)").all();
console.log('ADMIN_ACTIONS SCHEMA:', JSON.stringify(adminInfo, null, 2));

// Check index details
const indexList = db.prepare("SELECT name, sql FROM sqlite_master WHERE type='index' AND name NOT LIKE 'sqlite_%' ORDER BY name").all();
console.log('INDEX DEFINITIONS:', JSON.stringify(indexList, null, 2));

db.close();
