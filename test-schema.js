const db = require('better-sqlite3')('./confessional.db');

// List all tables
const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();
console.log('=== TABLES ===');
tables.forEach(t => console.log(t.name));

// Table schemas
console.log('\n=== SESSIONS SCHEMA ===');
const sessionsInfo = db.prepare("PRAGMA table_info(sessions)").all();
sessionsInfo.forEach(c => console.log(c.name, c.type, c.notnull ? 'NOT NULL' : '', c.pk ? 'PK' : '', c.dflt_value || ''));

console.log('\n=== CONFESSIONS SCHEMA ===');
const confessionsInfo = db.prepare("PRAGMA table_info(confessions)").all();
confessionsInfo.forEach(c => console.log(c.name, c.type, c.notnull ? 'NOT NULL' : '', c.pk ? 'PK' : '', c.dflt_value || ''));

console.log('\n=== SESSION_ATTEMPTS SCHEMA ===');
const attemptsInfo = db.prepare("PRAGMA table_info(session_attempts)").all();
attemptsInfo.forEach(c => console.log(c.name, c.type, c.notnull ? 'NOT NULL' : '', c.pk ? 'PK' : '', c.dflt_value || ''));

console.log('\n=== ADMIN_ACTIONS SCHEMA ===');
const adminInfo = db.prepare("PRAGMA table_info(admin_actions)").all();
adminInfo.forEach(c => console.log(c.name, c.type, c.notnull ? 'NOT NULL' : '', c.pk ? 'PK' : '', c.dflt_value || ''));

// List all indexes
console.log('\n=== INDEXES ===');
const indexes = db.prepare("SELECT name, tbl_name, sql FROM sqlite_master WHERE type='index' AND name NOT LIKE 'sqlite_%'").all();
indexes.forEach(i => console.log(i.name, '->', i.tbl_name, ':', i.sql));

// Check constraints on sessions table
console.log('\n=== SESSIONS CREATE SQL ===');
const sessionsSql = db.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='sessions'").get();
console.log(sessionsSql.sql);

console.log('\n=== CONFESSIONS CREATE SQL ===');
const confessionsSql = db.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='confessions'").get();
console.log(confessionsSql.sql);

console.log('\n=== ADMIN_ACTIONS CREATE SQL ===');
const adminSql = db.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='admin_actions'").get();
console.log(adminSql.sql);

db.close();
