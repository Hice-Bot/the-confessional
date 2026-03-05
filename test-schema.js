const Database = require('better-sqlite3');
const db = new Database('./confessional.db', { readonly: true });

// List all tables
const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name").all();
console.log('=== TABLES ===');
tables.forEach(t => console.log(' -', t.name));

// List all indexes
const indexes = db.prepare("SELECT name, tbl_name FROM sqlite_master WHERE type='index' AND name NOT LIKE 'sqlite_%' ORDER BY name").all();
console.log('\n=== INDEXES ===');
indexes.forEach(i => console.log(' -', i.name, 'on', i.tbl_name));

// Schema for each table
console.log('\n=== TABLE SCHEMAS ===');
['sessions', 'confessions', 'session_attempts', 'admin_actions'].forEach(table => {
  const schema = db.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name=?").get(table);
  console.log('\n--- ' + table + ' ---');
  console.log(schema ? schema.sql : 'TABLE NOT FOUND');
});

// Index definitions
console.log('\n=== INDEX DEFINITIONS ===');
['idx_confessions_created_at_id', 'idx_sessions_agent_id', 'idx_admin_actions_created_at', 'idx_admin_actions_confession_id'].forEach(idx => {
  const def = db.prepare("SELECT sql FROM sqlite_master WHERE type='index' AND name=?").get(idx);
  console.log('\n--- ' + idx + ' ---');
  console.log(def ? def.sql : 'INDEX NOT FOUND');
});

db.close();
console.log('\nDone.');
