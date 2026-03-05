var Database = require('better-sqlite3');
var db = new Database('confessional.db');

// Get all unflagged confession IDs
var unflagged = db.prepare('SELECT id FROM confessions WHERE flagged = 0').all();
console.log('Total unflagged confessions:', unflagged.length);

// Flag them all temporarily
var flagStmt = db.prepare('UPDATE confessions SET flagged = 1 WHERE flagged = 0');
var result = flagStmt.run();
console.log('Flagged:', result.changes, 'confessions');

// Verify empty
var count = db.prepare('SELECT COUNT(*) as c FROM confessions WHERE flagged = 0').get();
console.log('Unflagged after flagging all:', count.c);

// Store the IDs for later restoration
var fs = require('fs');
fs.writeFileSync('test-feature72-ids.json', JSON.stringify(unflagged.map(function(r) { return r.id; })));
console.log('Saved', unflagged.length, 'IDs for restoration');
db.close();
