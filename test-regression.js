const db = require('better-sqlite3')('confessional.db');

// List all tables
const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();
console.log('TABLES:', JSON.stringify(tables));

// Check sessions schema
const sessionsInfo = db.prepare("PRAGMA table_info(sessions)").all();
console.log('SESSIONS:', JSON.stringify(sessionsInfo));

// Check confessions schema
const confessionsInfo = db.prepare("PRAGMA table_info(confessions)").all();
console.log('CONFESSIONS:', JSON.stringify(confessionsInfo));

// Check session_attempts schema
const attemptsInfo = db.prepare("PRAGMA table_info(session_attempts)").all();
console.log('SESSION_ATTEMPTS:', JSON.stringify(attemptsInfo));

// Check admin_actions schema
const adminInfo = db.prepare("PRAGMA table_info(admin_actions)").all();
console.log('ADMIN_ACTIONS:', JSON.stringify(adminInfo));

// Check indexes
const indexes = db.prepare("SELECT name, tbl_name FROM sqlite_master WHERE type='index' AND name NOT LIKE 'sqlite_%'").all();
console.log('INDEXES:', JSON.stringify(indexes));

db.close();
console.log('DONE');
