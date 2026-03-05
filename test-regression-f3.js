const http = require('http');

const ADMIN_KEY = 'adm_test_key_001';
const AGENT_KEY = 'agt_test_key_001';
const BASE = 'http://localhost:3003';
const UNIQUE_TEXT = 'Regression test confession ' + Date.now();

function request(method, path, body, headers) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE);
    const opts = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname,
      method,
      headers: { 'Content-Type': 'application/json', ...headers }
    };
    const req = http.request(opts, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(data) }); }
        catch { resolve({ status: res.statusCode, body: data }); }
      });
    });
    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

async function main() {
  // Step 1: Create a session
  console.log('1. Creating session...');
  const sessRes = await request('POST', '/confessional/sessions',
    { agent_id: 'regression-test-agent' },
    { 'Authorization': 'Bearer ' + ADMIN_KEY }
  );
  console.log('   Session:', sessRes.status, JSON.stringify(sessRes.body));
  if (sessRes.status !== 201 && sessRes.status !== 200) {
    console.log('FAIL: Could not create session');
    process.exit(1);
  }
  const sessionId = sessRes.body.session_id || sessRes.body.id;
  console.log('   Session ID:', sessionId);

  // Step 2: Submit a confession
  console.log('2. Submitting confession...');
  const confRes = await request('POST', '/confessional/submit',
    { text: UNIQUE_TEXT },
    { 'Authorization': 'Bearer ' + AGENT_KEY, 'X-Session-ID': sessionId }
  );
  console.log('   Confession:', confRes.status, JSON.stringify(confRes.body));
  if (confRes.status !== 201 && confRes.status !== 200) {
    console.log('FAIL: Could not submit confession');
    process.exit(1);
  }

  // Step 3: Verify it appears in feed
  console.log('3. Checking feed before restart...');
  const feedRes = await request('GET', '/confessional/feed');
  console.log('   Feed status:', feedRes.status);
  const found = feedRes.body.confessions
    ? feedRes.body.confessions.some(c => c.text === UNIQUE_TEXT)
    : Array.isArray(feedRes.body) && feedRes.body.some(c => c.text === UNIQUE_TEXT);
  console.log('   Confession found in feed:', found);
  if (!found) {
    console.log('FAIL: Confession not found in feed before restart');
    process.exit(1);
  }

  // Output unique text for verification after restart
  console.log('UNIQUE_TEXT=' + UNIQUE_TEXT);
  console.log('PRE-RESTART PASS');
}

main().catch(e => { console.error(e); process.exit(1); });
