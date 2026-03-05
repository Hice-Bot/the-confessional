var Database = require('better-sqlite3');
var db = new Database('./confessional.db', { readonly: true });
var rows = db.prepare("SELECT id FROM confessions WHERE text LIKE 'F49_TEST_%'").all();
console.log('Remaining F49 test confessions: ' + rows.length);
db.close();
