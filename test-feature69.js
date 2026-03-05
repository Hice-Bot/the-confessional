// Test Feature #69: Empty state displays correctly
// Strategy: Flag ALL unflagged confessions, verify empty state, then unflag them all

const Database = require('better-sqlite3');
const path = require('path');
const http = require('http');

const DB_PATH = path.join(__dirname, 'confessional.db');
const db = new Database(DB_PATH);

// Step 1: Get all unflagged confession IDs
const unflagged = db.prepare('SELECT id FROM confessions WHERE flagged = 0').all();
console.log(`Found ${unflagged.length} unflagged confessions to temporarily flag`);

// Step 2: Flag them all in a transaction
const flagAll = db.transaction(() => {
  const stmt = db.prepare('UPDATE confessions SET flagged = 1 WHERE id = ?');
  for (const row of unflagged) {
    stmt.run(row.id);
  }
});
flagAll();
console.log('All confessions flagged');

// Verify count is 0
const count = db.prepare('SELECT COUNT(*) as c FROM confessions WHERE flagged = 0').get();
console.log('Unflagged count after flagging:', count.c);

// Save IDs for later unflag
const ids = unflagged.map(r => r.id);
require('fs').writeFileSync(
  path.join(__dirname, 'test-feature69-ids.json'),
  JSON.stringify(ids)
);
console.log('Saved confession IDs to test-feature69-ids.json');
console.log('Now open browser to verify empty state, then run test-feature69-restore.js');

db.close();
