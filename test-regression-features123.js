const Database = require('better-sqlite3');
const db = new Database('./confessional.db', { readonly: true });

// List all tables
const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name").all();
console.log('=== TABLES ===');
tables.forEach(t => console.log(t.name));

// List all indexes
const indexes = db.prepare("SELECT name, tbl_name FROM sqlite_master WHERE type='index' AND name NOT LIKE 'sqlite_%' ORDER BY name").all();
console.log('\n=== INDEXES ===');
indexes.forEach(i => console.log(i.name, '->', i.tbl_name));

// Check each table schema
console.log('\n=== SESSIONS TABLE ===');
const sessionsInfo = db.prepare("PRAGMA table_info(sessions)").all();
sessionsInfo.forEach(c => console.log(`  ${c.name} ${c.type} ${c.notnull ? 'NOT NULL' : 'NULLABLE'} ${c.pk ? 'PK' : ''} default=${c.dflt_value}`));

console.log('\n=== CONFESSIONS TABLE ===');
const confessionsInfo = db.prepare("PRAGMA table_info(confessions)").all();
confessionsInfo.forEach(c => console.log(`  ${c.name} ${c.type} ${c.notnull ? 'NOT NULL' : 'NULLABLE'} ${c.pk ? 'PK' : ''} default=${c.dflt_value}`));

console.log('\n=== SESSION_ATTEMPTS TABLE ===');
const attemptsInfo = db.prepare("PRAGMA table_info(session_attempts)").all();
attemptsInfo.forEach(c => console.log(`  ${c.name} ${c.type} ${c.notnull ? 'NOT NULL' : 'NULLABLE'} ${c.pk ? 'PK' : ''} default=${c.dflt_value}`));

console.log('\n=== ADMIN_ACTIONS TABLE ===');
const adminInfo = db.prepare("PRAGMA table_info(admin_actions)").all();
adminInfo.forEach(c => console.log(`  ${c.name} ${c.type} ${c.notnull ? 'NOT NULL' : 'NULLABLE'} ${c.pk ? 'PK' : ''} default=${c.dflt_value}`));

// Check index details
console.log('\n=== INDEX SQL ===');
const indexSql = db.prepare("SELECT name, sql FROM sqlite_master WHERE type='index' AND sql IS NOT NULL ORDER BY name").all();
indexSql.forEach(i => console.log(`  ${i.name}: ${i.sql}`));

db.close();
console.log('\nDone.');
