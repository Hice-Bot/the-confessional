var db = require('better-sqlite3')('./confessional.db');
db.prepare("DELETE FROM confessions WHERE text LIKE '%UNFLAG_WORKFLOW_TEST_31%'").run();
db.prepare("DELETE FROM admin_actions WHERE confession_id = '30e6f3d3-620a-4832-8da7-4fa8202033b7'").run();
console.log('Cleanup done');
db.close();
