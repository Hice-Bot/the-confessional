const http = require('http');

function request(method, path, body, headers = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(`http://localhost:3003${path}`);
    const opts = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      method,
      headers: { 'Content-Type': 'application/json', ...headers }
    };
    const req = http.request(opts, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        let parsed;
        try { parsed = JSON.parse(data); } catch { parsed = data; }
        resolve({ status: res.statusCode, body: parsed, headers: res.headers });
      });
    });
    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

const { randomUUID } = require('crypto');

async function main() {
  const ADM = 'Bearer adm_test_key_001';
  const AGT = 'Bearer agt_test_key_001';

  // Step 1: Create a confession
  console.log('=== Step 1: Create a confession ===');
  const agentId = randomUUID();
  const sessResp = await request('POST', '/confessional/sessions', { agent_id: agentId }, { Authorization: ADM });
  console.log('Session create:', sessResp.status, JSON.stringify(sessResp.body));
  const sessionId = sessResp.body.session_id;

  const uniqueText = 'FLAG_UNFLAG_TEST_87_' + Date.now();
  const submitResp = await request('POST', '/confessional/submit', { text: uniqueText }, {
    Authorization: AGT,
    'X-Session-ID': sessionId
  });
  console.log('Submit:', submitResp.status, JSON.stringify(submitResp.body));

  // Get the confession ID from agent feed (has more details)
  const feedResp = await request('GET', '/confessional/feed/agent?limit=1', null, { Authorization: AGT });
  console.log('Agent feed first item:', JSON.stringify(feedResp.body.confessions[0]));

  // We need the confession ID - human feed doesn't have it. Let's query DB directly.
  const Database = require('better-sqlite3');
  const db = new Database('./confessional.db', { readonly: true });
  const confession = db.prepare("SELECT id, text FROM confessions WHERE text LIKE ? ORDER BY created_at DESC LIMIT 1").get(`%FLAG_UNFLAG_TEST_87_%`);
  db.close();
  console.log('Confession from DB:', confession.id, confession.text.substring(0, 50));
  const confessionId = confession.id;

  // Step 2: POST /confessional/admin/flag with id → verify 200 response
  console.log('\n=== Step 2: Flag the confession ===');
  const flagResp = await request('POST', '/confessional/admin/flag', { id: confessionId, note: 'Test flag for feature 87' }, { Authorization: ADM });
  console.log('Flag status:', flagResp.status);
  console.log('Flag body:', JSON.stringify(flagResp.body));
  console.log('Flag is 200?', flagResp.status === 200 ? 'PASS' : 'FAIL');

  // Step 3: POST /confessional/admin/unflag with id → verify 200 response
  console.log('\n=== Step 3: Unflag the confession ===');
  const unflagResp = await request('POST', '/confessional/admin/unflag', { id: confessionId, note: 'Test unflag for feature 87' }, { Authorization: ADM });
  console.log('Unflag status:', unflagResp.status);
  console.log('Unflag body:', JSON.stringify(unflagResp.body));
  console.log('Unflag is 200?', unflagResp.status === 200 ? 'PASS' : 'FAIL');

  // Step 4: Verify both responses indicate success
  console.log('\n=== Step 4: Verify both responses indicate success ===');
  const flagSuccess = flagResp.status === 200 && flagResp.body && (flagResp.body.message || flagResp.body.success || flagResp.body.status);
  const unflagSuccess = unflagResp.status === 200 && unflagResp.body && (unflagResp.body.message || unflagResp.body.success || unflagResp.body.status);
  console.log('Flag response indicates success?', flagSuccess ? 'PASS' : 'FAIL');
  console.log('Unflag response indicates success?', unflagSuccess ? 'PASS' : 'FAIL');

  // Cleanup: delete the test confession
  console.log('\n=== Cleanup ===');
  const delResp = await request('DELETE', `/confessional/admin/confessions/${confessionId}`, { note: 'cleanup test 87' }, { Authorization: ADM });
  console.log('Delete cleanup:', delResp.status, JSON.stringify(delResp.body));

  // Overall result
  console.log('\n=== OVERALL ===');
  const allPass = flagResp.status === 200 && unflagResp.status === 200 && flagSuccess && unflagSuccess;
  console.log(allPass ? 'ALL STEPS PASS' : 'SOME STEPS FAILED');
}

main().catch(console.error);
