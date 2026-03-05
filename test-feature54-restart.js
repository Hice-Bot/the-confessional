var http = require('http');

var ACTION_ID = '49bf3bee-2e54-4b64-853c-74804447cd17';
var UNIQUE_NOTE = 'NOTE-PERSIST-CA5FD70D';
var EXPECTED_PREFIX = 'adm_test';
var CONFESSION_ID = '646f66bf-b4ac-49e8-a58b-d9167e00ab56';

// Step 1: Verify admin_actions table directly from DB after restart
var Database = require('better-sqlite3');
var db = new Database('./confessional.db', { readonly: true });

console.log('=== POST-RESTART VERIFICATION ===');

// Check by unique note
var action = db.prepare("SELECT * FROM admin_actions WHERE note = ?").get(UNIQUE_NOTE);
console.log('\n1. Admin action by note:', JSON.stringify(action, null, 2));

if (!action) {
  console.log('FAIL: Admin action NOT found after restart!');
  process.exit(1);
}

// Verify all fields
var passed = true;

console.log('\n2. Field verification:');

if (action.id === ACTION_ID) {
  console.log('  - Action ID: PASS (' + action.id + ')');
} else {
  console.log('  - Action ID: FAIL (expected ' + ACTION_ID + ', got ' + action.id + ')');
  passed = false;
}

if (action.action === 'flag') {
  console.log('  - Action type: PASS (flag)');
} else {
  console.log('  - Action type: FAIL (expected flag, got ' + action.action + ')');
  passed = false;
}

if (action.confession_id === CONFESSION_ID) {
  console.log('  - Confession ID: PASS (' + action.confession_id + ')');
} else {
  console.log('  - Confession ID: FAIL (expected ' + CONFESSION_ID + ', got ' + action.confession_id + ')');
  passed = false;
}

if (action.admin_key_prefix === EXPECTED_PREFIX) {
  console.log('  - Admin key prefix: PASS (' + action.admin_key_prefix + ')');
} else {
  console.log('  - Admin key prefix: FAIL (expected ' + EXPECTED_PREFIX + ', got ' + action.admin_key_prefix + ')');
  passed = false;
}

if (action.note === UNIQUE_NOTE) {
  console.log('  - Note: PASS (' + action.note + ')');
} else {
  console.log('  - Note: FAIL (expected ' + UNIQUE_NOTE + ', got ' + action.note + ')');
  passed = false;
}

if (action.created_at) {
  console.log('  - Created at: PASS (' + action.created_at + ')');
} else {
  console.log('  - Created at: FAIL (null/undefined)');
  passed = false;
}

db.close();

if (passed) {
  console.log('\n=== ALL CHECKS PASSED ===');
  console.log('Admin action history persists across server restart!');
} else {
  console.log('\n=== SOME CHECKS FAILED ===');
  process.exit(1);
}
