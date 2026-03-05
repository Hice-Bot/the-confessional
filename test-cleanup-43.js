var Database = require('better-sqlite3');
var crypto = require('crypto');
var db = new Database('/mnt/c/Users/turke/the-confessional/confessional.db');

var sessions = ['3046c7ef-9d6d-4a12-8022-a426fe3dd0cd', 'dcd90413-5be1-4ffa-8301-8514aee4c80e'];

sessions.forEach(function(sid) {
  var hash = crypto.createHash('sha256').update(sid).digest('hex');
  var conf = db.prepare('SELECT id FROM confessions WHERE session_hash = ?').get(hash);
  if (conf) {
    db.prepare('DELETE FROM confessions WHERE id = ?').run(conf.id);
    console.log('Deleted confession for session', sid);
  }
  db.prepare('DELETE FROM session_attempts WHERE session_hash = ?').run(hash);
  db.prepare('DELETE FROM sessions WHERE id = ?').run(sid);
  console.log('Cleaned session', sid);
});

console.log('All test data cleaned up');
db.close();
