const db = require('better-sqlite3')('./confessional.db');
db.prepare("DELETE FROM sessions WHERE id = 'e0225d10-bd8a-4169-923e-5b8261903ff3'").run();
db.close();
console.log('Cleaned up orphaned session');
