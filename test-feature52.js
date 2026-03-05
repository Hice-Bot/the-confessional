const http = require('http');
const crypto = require('crypto');

const BASE = 'http://localhost:3003';
const ADM_KEY = 'adm_test_key_001';
const AGT_KEY = 'agt_test_key_001';

function request(method, path, body, headers) {
  headers = headers || {};
  return new Promise(function(resolve, reject) {
    const url = new URL(path, BASE);
    const opts = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname,
      method: method,
      headers: Object.assign({
        'Content-Type': 'application/json',
      }, headers),
    };
    const req = http.request(opts, function(res) {
      let data = '';
      res.on('data', function(d) { data += d; });
      res.on('end', function() {
        try { resolve({ status: res.statusCode, body: JSON.parse(data) }); }
        catch(e) { resolve({ status: res.statusCode, body: data }); }
      });
    });
    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

async function main() {
  const agentId = crypto.randomUUID();

  // Step 1: Create a session
  console.log('\n=== Step 1: Create a session ===');
  const createRes = await request('POST', '/confessional/sessions', { agent_id: agentId }, {
    'Authorization': 'Bearer ' + ADM_KEY
  });
  console.log('Status:', createRes.status);
  console.log('Body:', JSON.stringify(createRes.body));
  if (createRes.status !== 200) throw new Error('Expected 200 on session create');
  const sessionId = createRes.body.session_id;
  console.log('PASS: Session created, id=' + sessionId);

  // Step 2: Submit a confession
  console.log('\n=== Step 2: Submit a confession ===');
  const uniqueText = 'SESSION_ATTEMPT_TEST_' + Date.now();
  const submitRes = await request('POST', '/confessional/submit', { text: uniqueText }, {
    'Authorization': 'Bearer ' + AGT_KEY,
    'X-Session-ID': sessionId,
  });
  console.log('Status:', submitRes.status);
  console.log('Body:', JSON.stringify(submitRes.body));
  if (submitRes.status !== 200) throw new Error('Expected 200 on submit, got ' + submitRes.status);
  console.log('PASS: Confession submitted');

  // Step 3: Query session_attempts table directly
  console.log('\n=== Step 3: Query session_attempts table directly ===');
  const Database = require('better-sqlite3');
  const db = new Database('/mnt/c/Users/turke/the-confessional/confessional.db', { readonly: true });

  // Compute the SHA-256 hash of the session_id
  const expectedHash = crypto.createHash('sha256').update(sessionId).digest('hex');
  console.log('Expected session_hash (SHA-256 of session_id):', expectedHash);

  const row = db.prepare('SELECT * FROM session_attempts WHERE session_hash = ?').get(expectedHash);
  console.log('DB row:', JSON.stringify(row));
  if (!row) throw new Error('No session_attempt entry found for session_hash');
  console.log('PASS: session_attempts entry exists');

  // Step 4: Verify an entry exists with the SHA-256 hash of the session_id
  console.log('\n=== Step 4: Verify entry has correct SHA-256 hash ===');
  if (row.session_hash !== expectedHash) throw new Error('Hash mismatch: ' + row.session_hash + ' vs ' + expectedHash);
  console.log('PASS: session_hash matches SHA-256 of session_id');

  // Step 5: Verify attempted_at timestamp is populated
  console.log('\n=== Step 5: Verify attempted_at timestamp ===');
  if (!row.attempted_at) throw new Error('attempted_at is missing');
  console.log('attempted_at:', row.attempted_at);
  const ts = new Date(row.attempted_at);
  if (isNaN(ts.getTime())) throw new Error('attempted_at is not a valid date: ' + row.attempted_at);
  console.log('PASS: attempted_at is a valid timestamp');

  db.close();

  // Cleanup
  console.log('\n=== Cleanup ===');
  const db2 = new Database('/mnt/c/Users/turke/the-confessional/confessional.db');
  // Find the confession by session_hash
  const confession = db2.prepare('SELECT id FROM confessions WHERE session_hash = ?').get(expectedHash);
  if (confession) {
    db2.prepare('DELETE FROM confessions WHERE id = ?').run(confession.id);
  }
  db2.prepare('DELETE FROM session_attempts WHERE session_hash = ?').run(expectedHash);
  db2.prepare('DELETE FROM sessions WHERE id = ?').run(sessionId);
  db2.close();
  console.log('Test data cleaned up');

  console.log('\nALL 5 STEPS PASSED for Feature #52');
}

main().catch(function(err) {
  console.error('\nFAILED:', err.message);
  process.exit(1);
});
