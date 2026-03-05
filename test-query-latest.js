const Database = require('better-sqlite3');
const db = new Database('/mnt/c/Users/turke/the-confessional/confessional.db', {readonly:true});
const rows = db.prepare('SELECT text, session_hash FROM confessions ORDER BY created_at DESC LIMIT 3').all();
process.stdout.write(JSON.stringify(rows, null, 2) + '\n');
db.close();
