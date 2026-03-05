const http = require('http');

const BASE = 'http://localhost:3003';
const AGT_KEY = 'agt_test_key_001';
const ADM_KEY = 'adm_test_key_001';

function request(method, path, body, headers = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE);
    const opts = {
      method,
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      headers: {
        'Content-Type': 'application/json',
        ...headers,
      },
    };
    const req = http.request(opts, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
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

async function main() {
  console.log('=== Feature 3: Data persists across server restart ===\n');

  // Step 1: Create a session
  console.log('Step 1: Creating session...');
  const sessionRes = await request('POST', '/confessional/sessions',
    { agent_id: 'regression-test-agent' },
    { Authorization: 'Bearer ' + ADM_KEY }
  );
  console.log('  Status:', sessionRes.status);
  console.log('  Body:', JSON.stringify(sessionRes.body));

  if (sessionRes.status !== 201 && sessionRes.status !== 200) {
    console.log('FAIL: Could not create session');
    process.exit(1);
  }

  const sessionId = sessionRes.body.session_id || sessionRes.body.id;
  console.log('  Session ID:', sessionId);

  // Step 2: Submit a confession
  const uniqueText = 'Regression test confession ' + Date.now();
  console.log('\nStep 2: Submitting confession...');
  console.log('  Text:', uniqueText);
  const submitRes = await request('POST', '/confessional/submit',
    { text: uniqueText },
    {
      Authorization: 'Bearer ' + AGT_KEY,
      'X-Session-ID': sessionId,
    }
  );
  console.log('  Status:', submitRes.status);
  console.log('  Body:', JSON.stringify(submitRes.body));

  if (submitRes.status !== 201 && submitRes.status !== 200) {
    console.log('FAIL: Could not submit confession');
    process.exit(1);
  }

  // Step 3: Verify confession appears in feed
  console.log('\nStep 3: Checking feed for confession...');
  const feedRes = await request('GET', '/confessional/feed');
  console.log('  Status:', feedRes.status);

  const confessions = feedRes.body.confessions || feedRes.body;
  const found = Array.isArray(confessions) && confessions.some(c => c.text === uniqueText);
  console.log('  Confession found in feed:', found);

  if (!found) {
    console.log('FAIL: Confession not found in feed before restart');
    process.exit(1);
  }

  console.log('\n=== PRE-RESTART CHECKS PASSED ===');
  console.log('Unique text to search after restart:', uniqueText);

  // Write the unique text to a temp file for the post-restart check
  require('fs').writeFileSync('test-regression-f3-text.txt', uniqueText);
  console.log('Saved unique text to test-regression-f3-text.txt');
}

main().catch(err => {
  console.error('ERROR:', err.message);
  process.exit(1);
});
