const http = require('http');
const Database = require('better-sqlite3');

const AGT_KEY = 'agt_test_key_001';
const ADM_KEY = 'adm_test_key_001';
const BASE = 'http://localhost:3003';

function request(method, path, headers, body) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE);
    const opts = {
      method,
      hostname: url.hostname,
      port: url.port,
      path: url.pathname,
      headers: headers || {}
    };
    const req = http.request(opts, (res) => {
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => {
        const text = Buffer.concat(chunks).toString();
        let json;
        try { json = JSON.parse(text); } catch(e) { json = null; }
        resolve({ status: res.statusCode, body: json, text });
      });
    });
    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

async function main() {
  // Step 1: Create a new session
  console.log('=== Step 1: Create session ===');
  const sessRes = await request('POST', '/confessional/sessions', {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer ' + ADM_KEY
  }, { agent_id: 'test-agent-68-v2' });
  console.log('Session:', JSON.stringify(sessRes.body));
  const sessionId = sessRes.body.session_id;

  // Step 2: Submit a confession
  console.log('\n=== Step 2: Submit confession ===');
  const submitRes = await request('POST', '/confessional/submit', {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer ' + AGT_KEY,
    'X-Session-ID': sessionId
  }, { text: 'HARD_DELETE_AUDIT_F68_AbCdEf' });
  console.log('Submit:', JSON.stringify(submitRes.body));

  // Step 3: Find the confession ID from the database
  console.log('\n=== Step 3: Find confession ID from database ===');
  const db = new Database('./confessional.db', { readonly: true });
  const row = db.prepare(
    "SELECT id, text FROM confessions WHERE text LIKE '%HARD_DELETE_AUDIT_F68_AbCdEf%' ORDER BY created_at DESC LIMIT 1"
  ).get();
  db.close();

  if (!row) {
    console.log('ERROR: Confession not found in database!');
    process.exit(1);
  }
  console.log('Confession ID:', row.id);
  console.log('Confession text:', row.text);

  // Step 4: Hard delete the confession
  console.log('\n=== Step 4: Hard delete confession ===');
  const deleteRes = await request('DELETE', '/confessional/admin/confessions/' + row.id, {
    'Authorization': 'Bearer ' + ADM_KEY
  });
  console.log('Delete status:', deleteRes.status);
  console.log('Delete response:', JSON.stringify(deleteRes.body));

  if (deleteRes.status !== 200) {
    console.log('ERROR: Delete did not return 200!');
    process.exit(1);
  }

  // Step 5: Query admin_actions for the delete action
  console.log('\n=== Step 5: Query admin_actions for delete action ===');
  const db2 = new Database('./confessional.db', { readonly: true });
  const action = db2.prepare(
    "SELECT * FROM admin_actions WHERE action = 'delete' ORDER BY created_at DESC LIMIT 1"
  ).get();
  db2.close();

  console.log('Latest delete action:', JSON.stringify(action, null, 2));

  // Step 6: Verify all required fields
  console.log('\n=== Step 6: Verification ===');
  const checks = {
    'action exists': !!action,
    'confession_id is null': action.confession_id === null,
    'action field is "delete"': action.action === 'delete',
    'admin_key_prefix is populated': action.admin_key_prefix && action.admin_key_prefix.length > 0,
    'admin_key_prefix starts with adm_': action.admin_key_prefix && action.admin_key_prefix.startsWith('adm_'),
    'created_at is populated': action.created_at && action.created_at.length > 0,
    'id is populated': action.id && action.id.length > 0
  };

  let allPass = true;
  for (const [name, result] of Object.entries(checks)) {
    console.log((result ? 'PASS' : 'FAIL') + ': ' + name);
    if (!result) allPass = false;
  }

  // Step 7: Verify confession is actually gone
  console.log('\n=== Step 7: Verify confession is deleted ===');
  const db3 = new Database('./confessional.db', { readonly: true });
  const gone = db3.prepare("SELECT * FROM confessions WHERE id = ?").get(row.id);
  db3.close();
  const isGone = gone === undefined;
  console.log((isGone ? 'PASS' : 'FAIL') + ': confession no longer in database');
  if (!isGone) allPass = false;

  console.log('\n' + (allPass ? 'ALL CHECKS PASSED' : 'SOME CHECKS FAILED'));

  // Step 8: Clean up - delete session and session_attempt
  console.log('\n=== Cleanup ===');
  const db4 = new Database('./confessional.db');
  db4.prepare("DELETE FROM session_attempts WHERE session_hash IN (SELECT session_hash FROM session_attempts ORDER BY attempted_at DESC LIMIT 1)").run();
  db4.prepare("DELETE FROM sessions WHERE id = ?").run(sessionId);
  // Also clean up the previous test confession that couldn't be deleted (no ID in agent feed)
  const stale = db4.prepare("SELECT id FROM confessions WHERE text LIKE '%HARD_DELETE_AUDIT_TEST_68%'").all();
  for (const s of stale) {
    db4.prepare("DELETE FROM confessions WHERE id = ?").run(s.id);
  }
  // Clean up the admin action we just created
  db4.prepare("DELETE FROM admin_actions WHERE id = ?").run(action.id);
  db4.close();
  console.log('Test data cleaned up');
}

main().catch(err => { console.error(err); process.exit(1); });
