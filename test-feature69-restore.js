// Restore all confessions after testing empty state
const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const DB_PATH = path.join(__dirname, 'confessional.db');
const db = new Database(DB_PATH);

const ids = JSON.parse(fs.readFileSync(path.join(__dirname, 'test-feature69-ids.json'), 'utf8'));
console.log(`Restoring ${ids.length} confessions...`);

const unflagAll = db.transaction(() => {
  const stmt = db.prepare('UPDATE confessions SET flagged = 0 WHERE id = ?');
  for (const id of ids) {
    stmt.run(id);
  }
});
unflagAll();

const count = db.prepare('SELECT COUNT(*) as c FROM confessions WHERE flagged = 0').get();
console.log('Unflagged count after restore:', count.c);

// Cleanup
fs.unlinkSync(path.join(__dirname, 'test-feature69-ids.json'));
console.log('Cleanup done');

db.close();
