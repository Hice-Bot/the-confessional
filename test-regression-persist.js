const http = require('http');

const ADMIN_KEY = 'adm_test_key_001';
const AGENT_KEY = 'agt_test_key_001';
const BASE = 'http://localhost:3003';
const UNIQUE_TEXT = 'Regression test persistence ' + Date.now();

function request(method, path, body, headers = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE);
    const opts = {
      method,
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      headers: { 'Content-Type': 'application/json', ...headers }
    };
    const req = http.request(opts, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, body: JSON.parse(data) });
        } catch {
          resolve({ status: res.statusCode, body: data });
        }
      });
    });
    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

async function run() {
  console.log('=== Feature 3: Data Persistence Test ===\n');

  // Step 1: Create a session
  console.log('1. Creating session...');
  const sessionRes = await request('POST', '/confessional/sessions', { agent_id: 'regression-test-agent' }, {
    'Authorization': 'Bearer ' + ADMIN_KEY
  });
  console.log('   Status:', sessionRes.status);
  console.log('   Body:', JSON.stringify(sessionRes.body));

  if (sessionRes.status !== 201 && sessionRes.status !== 200) {
    console.log('   FAIL: Could not create session');
    process.exit(1);
  }

  const sessionId = sessionRes.body.session_id || sessionRes.body.id;
  console.log('   Session ID:', sessionId);

  // Step 2: Submit a confession
  console.log('\n2. Submitting confession...');
  const confessionRes = await request('POST', '/confessional/submit',
    { text: UNIQUE_TEXT },
    {
      'Authorization': 'Bearer ' + AGENT_KEY,
      'X-Session-ID': sessionId
    }
  );
  console.log('   Status:', confessionRes.status);
  console.log('   Body:', JSON.stringify(confessionRes.body));

  if (confessionRes.status !== 201 && confessionRes.status !== 200) {
    console.log('   FAIL: Could not submit confession');
    process.exit(1);
  }

  // Step 3: Verify confession appears in feed
  console.log('\n3. Checking feed for confession...');
  const feedRes = await request('GET', '/confessional/feed');
  console.log('   Status:', feedRes.status);

  const confessions = feedRes.body.confessions || feedRes.body;
  const found = Array.isArray(confessions) && confessions.some(c => c.text === UNIQUE_TEXT);
  console.log('   Found in feed:', found);

  if (!found) {
    console.log('   FAIL: Confession not found in feed before restart');
    process.exit(1);
  }

  console.log('\n4. UNIQUE_TEXT marker for post-restart check:');
  console.log('   TEXT=' + UNIQUE_TEXT);
  console.log('\n=== Pre-restart checks PASSED ===');
}

run().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
