// Step 1: Create and submit a confession, then record the count
const http = require('http');
const crypto = require('crypto');
const fs = require('fs');

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

  // Step 1: Create session
  console.log('Creating session...');
  const createRes = await request('POST', '/confessional/sessions', { agent_id: agentId }, {
    'Authorization': 'Bearer ' + ADM_KEY
  });
  if (createRes.status !== 200) throw new Error('Session create failed: ' + createRes.status);
  const sessionId = createRes.body.session_id;
  console.log('Session created:', sessionId);

  // Submit confession with specific text
  console.log('Submitting confession...');
  const submitRes = await request('POST', '/confessional/submit', { text: 'RESTART_PERSIST_TEST' }, {
    'Authorization': 'Bearer ' + AGT_KEY,
    'X-Session-ID': sessionId,
  });
  if (submitRes.status !== 200) throw new Error('Submit failed: ' + submitRes.status);
  console.log('Confession submitted');

  // Verify it appears in feed
  const feedRes = await request('GET', '/confessional/feed', null, {});
  const found = feedRes.body.confessions.some(function(c) { return c.text === 'RESTART_PERSIST_TEST'; });
  if (!found) throw new Error('Confession not found in feed before restart');
  console.log('PASS: Confession appears in feed before restart');

  // Record the count
  const countRes = await request('GET', '/confessional/count', null, {});
  console.log('Count before restart:', countRes.body.count);

  // Save state for step 2
  const state = {
    sessionId: sessionId,
    countBefore: countRes.body.count,
  };
  fs.writeFileSync('/mnt/c/Users/turke/the-confessional/test-feature53-state.json', JSON.stringify(state));
  console.log('State saved. Now stop and restart the server, then run test-feature53-step2.js');
}

main().catch(function(err) {
  console.error('FAILED:', err.message);
  process.exit(1);
});
