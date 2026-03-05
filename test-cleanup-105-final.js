var Database = require('better-sqlite3');
var path = require('path');
var DB_PATH = path.join(__dirname, 'confessional.db');

var db = new Database(DB_PATH);

// Check for old F105 test data with _UNIQUE_F105 pattern
var old = db.prepare("SELECT id, text FROM confessions WHERE text LIKE '%_UNIQUE_F105%'").all();
console.log('Old _UNIQUE_F105 confessions: ' + old.length);

if (old.length > 0) {
  var result = db.prepare("DELETE FROM confessions WHERE text LIKE '%_UNIQUE_F105%'").run();
  console.log('Deleted: ' + result.changes);
}

// Also check for _F105_PGRTRIP pattern (new test marker)
var newOld = db.prepare("SELECT id, text FROM confessions WHERE text LIKE '%_F105_PGRTRIP%'").all();
console.log('Old _F105_PGRTRIP confessions: ' + newOld.length);
if (newOld.length > 0) {
  var result2 = db.prepare("DELETE FROM confessions WHERE text LIKE '%_F105_PGRTRIP%'").run();
  console.log('Deleted: ' + result2.changes);
}

var count = db.prepare('SELECT COUNT(*) as count FROM confessions WHERE flagged = 0').get();
console.log('\nFinal unflagged count: ' + count.count);

db.close();
