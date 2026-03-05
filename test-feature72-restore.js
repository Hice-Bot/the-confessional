var Database = require('better-sqlite3');
var fs = require('fs');
var db = new Database('confessional.db');

// Read saved IDs
var ids = JSON.parse(fs.readFileSync('test-feature72-ids.json', 'utf8'));
console.log('Restoring', ids.length, 'confessions...');

// Unflag them all
var unflagStmt = db.prepare('UPDATE confessions SET flagged = 0 WHERE id = ?');
var restored = 0;
ids.forEach(function(id) {
    unflagStmt.run(id);
    restored++;
});

console.log('Restored:', restored, 'confessions');

// Verify
var count = db.prepare('SELECT COUNT(*) as c FROM confessions WHERE flagged = 0').get();
console.log('Unflagged count now:', count.c);

// Clean up temp file
fs.unlinkSync('test-feature72-ids.json');
console.log('Cleaned up temp file');
db.close();
