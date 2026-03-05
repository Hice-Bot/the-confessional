const db = require('better-sqlite3')('./confessional.db');

// Step 4: Verify confession is still flagged
const confession = db.prepare("SELECT id, flagged FROM confessions WHERE id = '30416de8-9339-4562-8158-210ad3fa2e13'").get();
if (confession) {
  console.log('Step 4: Confession flagged value:', confession.flagged);
  if (confession.flagged === 1) {
    console.log('PASS: Confession is still flagged');
  } else {
    console.log('FAIL: Confession should be flagged but is not');
    process.exit(1);
  }
} else {
  console.log('FAIL: Confession not found');
  process.exit(1);
}

// Step 5: Verify admin_actions has two flag entries for this confession
const actions = db.prepare("SELECT * FROM admin_actions WHERE confession_id = '30416de8-9339-4562-8158-210ad3fa2e13' AND action = 'flag' ORDER BY created_at").all();
console.log('Step 5: Flag action count:', actions.length);
if (actions.length === 2) {
  console.log('PASS: Two flag entries found');
  actions.forEach(function(a, i) {
    console.log('  Action ' + (i+1) + ': action=' + a.action + ', note=' + a.note + ', prefix=' + a.admin_key_prefix);
  });
} else {
  console.log('FAIL: Expected 2 flag entries, got', actions.length);
  process.exit(1);
}

// Cleanup
db.prepare("DELETE FROM confessions WHERE id = '30416de8-9339-4562-8158-210ad3fa2e13'").run();
db.prepare("DELETE FROM admin_actions WHERE confession_id = '30416de8-9339-4562-8158-210ad3fa2e13'").run();
console.log('Cleanup done');
console.log('ALL STEPS PASSED');

db.close();
