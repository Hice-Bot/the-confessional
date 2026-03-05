const Database = require('better-sqlite3');
const db = new Database('./confessional.db');
const row = db.prepare("SELECT id FROM confessions WHERE text LIKE '%SESSION_WORKFLOW_TEST_33%'").get();
if (row) {
  console.log('Found confession ID:', row.id);
  db.prepare("DELETE FROM confessions WHERE id = ?").run(row.id);
  console.log('Deleted test confession');
} else {
  console.log('Test confession not found');
}
db.close();
