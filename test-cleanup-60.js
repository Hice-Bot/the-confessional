const db = require('better-sqlite3')('./confessional.db');
const row = db.prepare("SELECT id FROM confessions WHERE text LIKE '%ONE_PER_SESSION_TEST_60%'").get();
if (row) {
  console.log('Found confession ID:', row.id);
  db.prepare("DELETE FROM confessions WHERE id = ?").run(row.id);
  console.log('Deleted test confession');
} else {
  console.log('Test confession not found');
}
db.close();
