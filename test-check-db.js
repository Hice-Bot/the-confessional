var Database = require('better-sqlite3');
var db = new Database('./confessional.db', { readonly: true });
var rows = db.prepare('SELECT id, text FROM confessions ORDER BY created_at DESC LIMIT 3').all();
rows.forEach(function(r) { console.log(r.id, ':', r.text.substring(0, 80)); });
db.close();
