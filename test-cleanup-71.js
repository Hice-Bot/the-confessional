var Database = require('better-sqlite3');
var db = new Database('./confessional.db');
var result = db.prepare("DELETE FROM sessions WHERE id = 'bcd279c6-2b0a-4c3e-a974-c7c3500dfeed'").run();
console.log('Deleted:', result.changes, 'rows');
db.close();
