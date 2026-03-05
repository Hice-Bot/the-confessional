const db = require('better-sqlite3')('./confessional.db', { readonly: true });

// List all tables
const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name").all();
console.log('=== TABLES ===');
tables.forEach(t => console.log(t.name));

// List all indexes
const indexes = db.prepare("SELECT name, tbl_name FROM sqlite_master WHERE type='index' AND name NOT LIKE 'sqlite_%' ORDER BY name").all();
console.log('\n=== INDEXES ===');
indexes.forEach(i => console.log(i.name, '->', i.tbl_name));

// Schema for each table
console.log('\n=== SESSIONS SCHEMA ===');
const sessionsInfo = db.prepare('PRAGMA table_info(sessions)').all();
sessionsInfo.forEach(c => console.log(JSON.stringify(c)));

console.log('\n=== CONFESSIONS SCHEMA ===');
const confessionsInfo = db.prepare('PRAGMA table_info(confessions)').all();
confessionsInfo.forEach(c => console.log(JSON.stringify(c)));

console.log('\n=== SESSION_ATTEMPTS SCHEMA ===');
const attemptsInfo = db.prepare('PRAGMA table_info(session_attempts)').all();
attemptsInfo.forEach(c => console.log(JSON.stringify(c)));

console.log('\n=== ADMIN_ACTIONS SCHEMA ===');
const adminInfo = db.prepare('PRAGMA table_info(admin_actions)').all();
adminInfo.forEach(c => console.log(JSON.stringify(c)));

// Index details
console.log('\n=== INDEX DETAILS ===');
indexes.forEach(i => {
  const info = db.prepare('PRAGMA index_info(' + i.name + ')').all();
  console.log(i.name + ':', info.map(x => x.name).join(', '));
});

// Check constraints via SQL
console.log('\n=== TABLE SQL ===');
const allSql = db.prepare("SELECT name, sql FROM sqlite_master WHERE type='table' ORDER BY name").all();
allSql.forEach(t => console.log(t.name + ':', t.sql));

console.log('\n=== INDEX SQL ===');
const allIdxSql = db.prepare("SELECT name, sql FROM sqlite_master WHERE type='index' AND sql IS NOT NULL ORDER BY name").all();
allIdxSql.forEach(i => console.log(i.name + ':', i.sql));

db.close();
console.log('\nDone.');
