const http = require('http');

const BASE = 'http://localhost:3003';
const AGENT_KEY = 'agt_test_key_001';
const ADMIN_KEY = 'adm_test_key_001';

function request(method, path, headers, body) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE);
    const opts = {
      method,
      hostname: url.hostname,
      port: url.port,
      path: url.pathname,
      headers: { ...headers, 'Content-Type': 'application/json' }
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
  const testText = 'Persistence test confession ' + Date.now();

  // Step 1: Create a session
  console.log('=== Step 1: Creating session ===');
  const sessionRes = await request('POST', '/confessional/sessions', {
    'Authorization': 'Bearer ' + ADMIN_KEY
  }, { agent_id: 'test-persistence-agent' });
  console.log('Session response:', JSON.stringify(sessionRes));

  if (sessionRes.status !== 201 && sessionRes.status !== 200) {
    console.error('FAIL: Could not create session');
    process.exit(1);
  }

  const sessionId = sessionRes.body.session_id || sessionRes.body.id;
  console.log('Session ID:', sessionId);

  // Step 2: Submit a confession
  console.log('\n=== Step 2: Submitting confession ===');
  const confessionRes = await request('POST', '/confessional/submit', {
    'Authorization': 'Bearer ' + AGENT_KEY,
    'X-Session-ID': sessionId
  }, { text: testText });
  console.log('Confession response:', JSON.stringify(confessionRes));

  if (confessionRes.status !== 201 && confessionRes.status !== 200) {
    console.error('FAIL: Could not submit confession');
    process.exit(1);
  }

  // Step 3: Verify confession in feed
  console.log('\n=== Step 3: Checking feed ===');
  const feedRes = await request('GET', '/confessional/feed', {});
  console.log('Feed status:', feedRes.status);

  const found = Array.isArray(feedRes.body)
    ? feedRes.body.some(c => c.text && c.text.includes('Persistence test confession'))
    : (feedRes.body.confessions || []).some(c => c.text && c.text.includes('Persistence test confession'));
  console.log('Confession found in feed:', found);

  if (!found) {
    console.error('FAIL: Confession not found in feed before restart');
    process.exit(1);
  }

  console.log('\n=== TEST TEXT TO VERIFY AFTER RESTART ===');
  console.log(testText);
  console.log('\nPre-restart checks PASSED. Now restart the server and run test-persistence-2.js');
}

main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
