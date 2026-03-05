const db = require('better-sqlite3')('confessional.db', { readonly: true });

// Check the full CREATE TABLE SQL for each table
const createStatements = db.prepare("SELECT name, sql FROM sqlite_master WHERE type='table' ORDER BY name").all();
createStatements.forEach(t => {
  console.log('--- ' + t.name + ' ---');
  console.log(t.sql);
  console.log('');
});

db.close();
