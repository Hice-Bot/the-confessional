var Database = require('better-sqlite3');
var crypto = require('crypto');
var db = new Database('/mnt/c/Users/turke/the-confessional/confessional.db');
var row = db.prepare("SELECT id FROM confessions WHERE text LIKE '%DUP_TEST_FEATURE42%'").get();
if (row) {
  db.prepare('DELETE FROM confessions WHERE id = ?').run(row.id);
  console.log('Cleaned up confession:', row.id);
}
var hash = crypto.createHash('sha256').update('b29386a8-f245-4005-aa55-413790621a53').digest('hex');
db.prepare('DELETE FROM session_attempts WHERE session_hash = ?').run(hash);
db.prepare('DELETE FROM sessions WHERE id = ?').run('b29386a8-f245-4005-aa55-413790621a53');
console.log('Test data cleaned up');
db.close();
