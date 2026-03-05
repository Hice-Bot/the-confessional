const Database = require('better-sqlite3');
const db = new Database('/mnt/c/Users/turke/the-confessional/confessional.db');
const r = db.prepare("DELETE FROM confessions WHERE text LIKE 'HASH_ISOLATION_TEST_%'").run();
process.stdout.write('Deleted ' + r.changes + ' stale test rows\n');
db.close();
