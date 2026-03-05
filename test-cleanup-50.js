var Database = require('better-sqlite3');
var db = new Database('./confessional.db');
var rows = db.prepare("SELECT id FROM confessions WHERE text LIKE 'F50_%'").all();
for (var i = 0; i < rows.length; i++) {
  db.prepare("DELETE FROM confessions WHERE id = ?").run(rows[i].id);
}
console.log('Cleaned up ' + rows.length + ' F50 test confessions');
db.close();
