const Database = require('better-sqlite3');
const db = new Database('./confessional.db');
const row = db.prepare("SELECT id FROM confessions WHERE text LIKE 'FEATURE83%' LIMIT 1").get();
console.log(row ? row.id : 'NOT_FOUND');
db.close();
