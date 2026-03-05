const db = require('better-sqlite3')('confessional.db');

// List all tables
const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();
console.log('=== TABLES ===');
tables.forEach(t => console.log(' -', t.name));

// List all indexes
const indexes = db.prepare("SELECT name, tbl_name, sql FROM sqlite_master WHERE type='index' AND sql IS NOT NULL").all();
console.log('\n=== INDEXES ===');
indexes.forEach(i => console.log(' -', i.name, 'on', i.tbl_name, ':', i.sql));

// Table schemas via CREATE statements
const createStmts = db.prepare("SELECT name, sql FROM sqlite_master WHERE type='table'").all();
console.log('\n=== CREATE STATEMENTS ===');
createStmts.forEach(s => console.log(s.sql + '\n'));

// Detailed column info for each expected table
['sessions', 'confessions', 'session_attempts', 'admin_actions'].forEach(t => {
  try {
    const info = db.prepare('PRAGMA table_info(' + t + ')').all();
    console.log('=== ' + t.toUpperCase() + ' COLUMNS ===');
    info.forEach(col => {
      console.log('  ', col.name, '|', col.type, '| notnull:', col.notnull, '| default:', col.dflt_value, '| pk:', col.pk);
    });
    console.log('');
  } catch (e) {
    console.log('ERROR reading table', t, ':', e.message);
  }
});

db.close();
console.log('=== DONE ===');
