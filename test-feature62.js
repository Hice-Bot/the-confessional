const db = require('better-sqlite3')('./confessional.db');
const row = db.prepare("SELECT id, flagged FROM confessions WHERE text LIKE '%RE_FLAG_IDEMPOTENT_TEST_62%'").get();
if (row) {
  console.log('CONFESSION_ID=' + row.id);
  console.log('FLAGGED=' + row.flagged);
} else {
  console.log('NOT_FOUND');
}
db.close();
