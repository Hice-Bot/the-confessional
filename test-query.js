var db = require('better-sqlite3')('./confessional.db');
var row = db.prepare("SELECT id, flagged FROM confessions WHERE text LIKE '%IDEMPOTENT_UNFLAG_TEST_63%'").get();
console.log('Flagged status:', JSON.stringify(row));
db.prepare("DELETE FROM confessions WHERE text LIKE '%IDEMPOTENT_UNFLAG_TEST_63%'").run();
db.prepare("DELETE FROM admin_actions WHERE confession_id = '6070f715-fb29-4dde-8c0d-7410679ead8b'").run();
console.log('Cleanup done');
db.close();
