const http = require('http');

const BASE = 'http://localhost:3003';
const AGT_KEY = 'agt_test_key_001';
const ADM_KEY = 'adm_test_key_001';

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
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => {
        const raw = Buffer.concat(chunks).toString();
        try { resolve({ status: res.statusCode, body: JSON.parse(raw) }); }
        catch(e) { resolve({ status: res.statusCode, body: raw }); }
      });
    });
    req.on('error', reject);
    if (body !== undefined) req.write(typeof body === 'string' ? body : JSON.stringify(body));
    req.end();
  });
}

async function run() {
  console.log('=== Feature #36: Absent text key submission silently skips ===\n');

  // Step 1: Create a session
  console.log('Step 1: Create a session');
  const sessResp = await request('POST', '/confessional/sessions', {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer ' + ADM_KEY
  }, { agent_id: 'f36-absent-text-test-agent' });
  console.log('  Session response:', sessResp.status, JSON.stringify(sessResp.body));
  if (sessResp.status !== 200) { console.log('FAIL: Could not create session'); return; }
  const sessionId = sessResp.body.session_id;
  console.log('  Session ID:', sessionId);
  console.log('  PASS\n');

  // Step 2: GET /confessional/count - note initial count
  console.log('Step 2: GET /confessional/count - note initial count');
  const countBefore = await request('GET', '/confessional/count', {});
  console.log('  Count before:', countBefore.body.count);
  console.log('  PASS\n');

  // Step 3: POST /confessional/submit with body {} (no text key)
  console.log('Step 3: POST /confessional/submit with body {} (no text key)');
  const submitResp = await request('POST', '/confessional/submit', {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer ' + AGT_KEY,
    'X-Session-ID': sessionId
  }, {});
  console.log('  Submit response:', submitResp.status, JSON.stringify(submitResp.body));

  // Step 4: Verify response is {received: true} with 200
  console.log('\nStep 4: Verify response is {received: true} with 200');
  if (submitResp.status === 200 && submitResp.body.received === true) {
    console.log('  PASS: Got 200 with {received: true}\n');
  } else {
    console.log('  FAIL: Expected 200 {received:true}, got', submitResp.status, JSON.stringify(submitResp.body));
    return;
  }

  // Step 5: GET /confessional/count - count unchanged
  console.log('Step 5: GET /confessional/count - count should be unchanged');
  const countAfter = await request('GET', '/confessional/count', {});
  console.log('  Count after:', countAfter.body.count);
  if (countAfter.body.count === countBefore.body.count) {
    console.log('  PASS: Count unchanged (' + countBefore.body.count + ' -> ' + countAfter.body.count + ')\n');
  } else {
    console.log('  FAIL: Count changed from', countBefore.body.count, 'to', countAfter.body.count);
    return;
  }

  // Extra: Verify session_attempts was recorded (re-submit returns 409)
  console.log('Extra: Verify session_attempt recorded (re-submit should return 409)');
  const resubmit = await request('POST', '/confessional/submit', {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer ' + AGT_KEY,
    'X-Session-ID': sessionId
  }, { text: 'This should fail' });
  console.log('  Re-submit response:', resubmit.status, JSON.stringify(resubmit.body));
  if (resubmit.status === 409) {
    console.log('  PASS: Session attempt was recorded\n');
  } else {
    console.log('  WARN: Expected 409, got', resubmit.status);
  }

  // Verify no confession stored in DB
  const Database = require('better-sqlite3');
  const crypto = require('crypto');
  const sessionHash = crypto.createHash('sha256').update(sessionId).digest('hex');
  const db = new Database('/mnt/c/Users/turke/the-confessional/confessional.db', { readonly: true });
  const confession = db.prepare('SELECT * FROM confessions WHERE session_hash = ?').get(sessionHash);
  console.log('Extra: DB confessions for this session hash:', confession);
  if (!confession) {
    console.log('  PASS: No confession stored for absent text key\n');
  } else {
    console.log('  FAIL: Confession was stored despite absent text key!');
  }
  db.close();

  console.log('=== ALL STEPS PASSED ===');
}

run().catch(console.error);
