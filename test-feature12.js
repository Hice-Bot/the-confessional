const http = require('http');

const BASE = 'http://localhost:3003';
const AGT_KEY = 'agt_test_key_001';
const ADM_KEY = 'adm_test_key_001';
const ADM_KEY_PREFIX_EXPECTED = ADM_KEY.substring(0, 8); // "adm_test"

function request(method, path, headers, body) {
  headers = headers || {};
  body = body || null;
  return new Promise(function(resolve, reject) {
    var url = new URL(path, BASE);
    var opts = { method: method, hostname: url.hostname, port: url.port, path: url.pathname, headers: headers };
    if (body) {
      var data = JSON.stringify(body);
      opts.headers['Content-Type'] = 'application/json';
      opts.headers['Content-Length'] = Buffer.byteLength(data);
    }
    var req = http.request(opts, function(res) {
      var d = '';
      res.on('data', function(c) { d += c; });
      res.on('end', function() {
        try { resolve({ status: res.statusCode, body: JSON.parse(d) }); }
        catch(e) { resolve({ status: res.statusCode, body: d }); }
      });
    });
    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

async function run() {
  console.log('=== Feature #12: Admin audit log stores only key prefix ===\n');
  console.log('Admin key used: "' + ADM_KEY + '"');
  console.log('Expected prefix (first 8 chars): "' + ADM_KEY_PREFIX_EXPECTED + '"');
  console.log();

  // Step 1: Create session
  console.log('Step 1: Create session...');
  var sessRes = await request('POST', '/confessional/sessions', { 'Authorization': 'Bearer ' + ADM_KEY }, { agent_id: 'f47ac10b-58cc-4372-a567-0e02b2c3d479' });
  console.log('  Session create: ' + sessRes.status, sessRes.body);
  var sessionId = sessRes.body.session_id;

  // Step 2: Submit confession
  console.log('\nStep 2: Submit confession...');
  var uniqueText = 'AUDITPREFIXTEST' + Math.random().toString(36).substring(2, 10);
  var subRes = await request('POST', '/confessional/submit',
    { 'Authorization': 'Bearer ' + AGT_KEY, 'X-Session-ID': sessionId },
    { text: uniqueText });
  console.log('  Submit: ' + subRes.status, subRes.body);

  // Step 3: Get the confession ID from DB
  console.log('\nStep 3: Get confession ID from database...');
  var Database = require('better-sqlite3');
  var db = new Database('/mnt/c/Users/turke/the-confessional/confessional.db', { readonly: true });
  var confRow = db.prepare("SELECT id FROM confessions WHERE text LIKE ?").get('%AUDITPREFIXTEST%');
  console.log('  Confession ID: ' + confRow.id);
  db.close();

  // Step 4: Flag the confession
  console.log('\nStep 4: Flag confession with adm_ key...');
  await new Promise(function(r) { setTimeout(r, 500); });
  var flagRes = await request('POST', '/confessional/admin/flag',
    { 'Authorization': 'Bearer ' + ADM_KEY },
    { id: confRow.id, note: 'Testing audit prefix logging' });
  console.log('  Flag: ' + flagRes.status, flagRes.body);

  // Step 5: Query admin_actions table directly
  console.log('\nStep 5: Query admin_actions table...');
  var db2 = new Database('/mnt/c/Users/turke/the-confessional/confessional.db', { readonly: true });

  var actions = db2.prepare("SELECT * FROM admin_actions WHERE confession_id = ? ORDER BY created_at DESC").all(confRow.id);
  console.log('  Found ' + actions.length + ' admin action(s) for this confession:');

  for (var i = 0; i < actions.length; i++) {
    var action = actions[i];
    console.log('\n  Action: ' + action.action);
    console.log('  admin_key_prefix: "' + action.admin_key_prefix + '"');
    console.log('  admin_key_prefix length: ' + action.admin_key_prefix.length);
    console.log('  Expected prefix: "' + ADM_KEY_PREFIX_EXPECTED + '"');
    console.log('  Prefix matches first 8 chars: ' + (action.admin_key_prefix === ADM_KEY_PREFIX_EXPECTED));
    console.log('  confession_id: ' + action.confession_id);
    console.log('  note: ' + action.note);
  }

  // Step 6: Verify no column contains the full admin key
  console.log('\nStep 6: Check no column contains full admin key...');
  var allActions = db2.prepare("SELECT * FROM admin_actions").all();
  var fullKeyFound = false;
  for (var j = 0; j < allActions.length; j++) {
    var act = allActions[j];
    var cols = Object.entries(act);
    for (var k = 0; k < cols.length; k++) {
      if (typeof cols[k][1] === 'string' && cols[k][1].includes(ADM_KEY)) {
        console.log('  FAIL: Full admin key found in column "' + cols[k][0] + '"!');
        fullKeyFound = true;
      }
    }
  }
  if (!fullKeyFound) {
    console.log('  PASS: No column in admin_actions contains the full admin key "' + ADM_KEY + '"');
  }

  var tableInfo = db2.prepare("PRAGMA table_info(admin_actions)").all();
  console.log('\n  admin_actions columns: ' + tableInfo.map(function(c) { return c.name; }).join(', '));

  var flagAction = actions[0];
  var checks = [
    { name: 'admin_key_prefix is exactly 8 chars', pass: flagAction && flagAction.admin_key_prefix.length === 8 },
    { name: 'admin_key_prefix matches first 8 chars of key', pass: flagAction && flagAction.admin_key_prefix === ADM_KEY_PREFIX_EXPECTED },
    { name: 'No column contains full admin key', pass: !fullKeyFound },
  ];

  console.log('\n=== Verification Summary ===');
  for (var m = 0; m < checks.length; m++) {
    console.log('  ' + (checks[m].pass ? 'PASS' : 'FAIL') + ': ' + checks[m].name);
  }

  // Cleanup: delete the confession
  await new Promise(function(r) { setTimeout(r, 500); });
  var delRes = await request('DELETE', '/confessional/admin/confessions/' + confRow.id,
    { 'Authorization': 'Bearer ' + ADM_KEY },
    { note: 'Cleanup after feature 12 test' });
  console.log('\nCleanup: Delete confession -> ' + delRes.status);

  // Also verify delete action has correct prefix
  await new Promise(function(r) { setTimeout(r, 200); });
  var db3 = new Database('/mnt/c/Users/turke/the-confessional/confessional.db', { readonly: true });
  var deleteAction = db3.prepare("SELECT * FROM admin_actions WHERE action = 'delete' ORDER BY created_at DESC LIMIT 1").get();
  console.log('Delete action prefix: "' + deleteAction.admin_key_prefix + '" (length: ' + deleteAction.admin_key_prefix.length + ')');
  console.log('Delete action prefix matches: ' + (deleteAction.admin_key_prefix === ADM_KEY_PREFIX_EXPECTED));
  db3.close();

  var allPass = checks.every(function(c) { return c.pass; });
  console.log('\n=== OVERALL: ' + (allPass ? 'ALL CHECKS PASSED' : 'SOME CHECKS FAILED') + ' ===');
}

run().catch(console.error);
