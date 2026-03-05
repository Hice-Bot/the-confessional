const db = require('better-sqlite3')('./confessional.db');
const row = db.prepare("SELECT id FROM confessions WHERE text LIKE '%API_UNIQUE_TEST_103%'").get();
if (row) {
  db.prepare("DELETE FROM confessions WHERE id = ?").run(row.id);
  console.log('Deleted test confession:', row.id);
} else {
  console.log('Test confession not found');
}
db.close();
