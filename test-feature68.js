const http = require('http');

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
  // Step 1: Get confession ID from agent feed
  console.log('=== Step 1: Find confession ID ===');
  const feedRes = await request('GET', '/confessional/feed/agent', {
    'Authorization': 'Bearer ' + AGT_KEY
  });
  const confession = feedRes.body.confessions.find(c => c.text && c.text.includes('HARD_DELETE_AUDIT_TEST_68'));
  if (!confession) {
    console.log('ERROR: Confession not found in feed!');
    process.exit(1);
  }
  console.log('Confession found:', JSON.stringify(confession, null, 2));
  const confessionId = confession.id;
  console.log('Confession ID:', confessionId);

  // Step 2: Hard delete the confession
  console.log('\n=== Step 2: Hard delete confession ===');
  const deleteRes = await request('DELETE', '/confessional/admin/confessions/' + confessionId, {
    'Authorization': 'Bearer ' + ADM_KEY
  });
  console.log('Delete status:', deleteRes.status);
  console.log('Delete response:', JSON.stringify(deleteRes.body));

  // Step 3: Query admin_actions table directly via SQLite
  console.log('\n=== Step 3: Query admin_actions for delete action ===');
  const Database = require('better-sqlite3');
  const db = new Database('./confessional.db', { readonly: true });

  // Find the most recent delete action
  const actions = db.prepare(
    "SELECT * FROM admin_actions WHERE action = 'delete' ORDER BY created_at DESC LIMIT 5"
  ).all();

  console.log('Recent delete actions:');
  for (const a of actions) {
    console.log(JSON.stringify(a, null, 2));
  }

  // Step 4: Verify the specific delete action
  console.log('\n=== Step 4: Verification ===');
  const latestDelete = actions[0];
  if (!latestDelete) {
    console.log('ERROR: No delete action found in admin_actions!');
    db.close();
    process.exit(1);
  }

  const checks = {
    'confession_id is null': latestDelete.confession_id === null,
    'action is delete': latestDelete.action === 'delete',
    'admin_key_prefix is populated': latestDelete.admin_key_prefix && latestDelete.admin_key_prefix.length > 0,
    'admin_key_prefix starts with adm_': latestDelete.admin_key_prefix && latestDelete.admin_key_prefix.startsWith('adm_'),
    'created_at is populated': latestDelete.created_at && latestDelete.created_at.length > 0,
    'id is populated': latestDelete.id && latestDelete.id.length > 0
  };

  let allPass = true;
  for (const [name, result] of Object.entries(checks)) {
    console.log((result ? 'PASS' : 'FAIL') + ': ' + name);
    if (!result) allPass = false;
  }

  console.log('\n' + (allPass ? 'ALL CHECKS PASSED' : 'SOME CHECKS FAILED'));

  db.close();
}

main().catch(err => { console.error(err); process.exit(1); });
