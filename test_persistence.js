const http = require('http');

const BASE = 'http://localhost:3003';
const AGENT_KEY = 'agt_test_key_001';
const ADMIN_KEY = 'adm_test_key_001';

function request(method, path, body, headers) {
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
        try {
          resolve({ status: res.statusCode, body: JSON.parse(data) });
        } catch (e) {
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
  // Use a unique text that won't be PII-scrubbed (no long numbers, no emails, etc.)
  const uniqueMarker = 'PERSIST-REGTEST-WALRUS-FALCON-ORCHID-VELVET-ZEPHYR';

  // Step 1: Create a session
  console.log('=== Step 1: Create session ===');
  const sessionRes = await request('POST', '/confessional/sessions', { agent_id: 'test-agent-persistence' }, {
    'Authorization': 'Bearer ' + ADMIN_KEY
  });
  console.log('Session response status:', sessionRes.status);
  console.log('Session response body:', JSON.stringify(sessionRes.body));

  const sessionId = sessionRes.body.session_id || sessionRes.body.id;
  if (!sessionId) {
    console.log('ERROR: No session ID returned');
    process.exit(1);
  }
  console.log('Session ID:', sessionId);

  // Step 2: Submit a confession
  console.log('\n=== Step 2: Submit confession ===');
  const confessionRes = await request('POST', '/confessional/submit', {
    text: uniqueMarker
  }, {
    'Authorization': 'Bearer ' + AGENT_KEY,
    'X-Session-ID': sessionId
  });
  console.log('Confession response status:', confessionRes.status);
  console.log('Confession response body:', JSON.stringify(confessionRes.body));

  // Step 3: Verify confession appears in feed
  console.log('\n=== Step 3: Verify in feed ===');
  const feedRes = await request('GET', '/confessional/feed?limit=50', null, {});
  console.log('Feed response status:', feedRes.status);
  const confessions = feedRes.body.confessions || feedRes.body;
  const found = Array.isArray(confessions) && confessions.some(c => c.text.includes('PERSIST-REGTEST-WALRUS-FALCON-ORCHID-VELVET-ZEPHYR'));
  console.log('Confession found in feed:', found);

  if (!found) {
    console.log('ERROR: Confession not found in feed before restart');
    console.log('Feed texts:', confessions.map(c => c.text));
    process.exit(1);
  }

  console.log('\n=== PRE-RESTART CHECKS PASSED ===');
  console.log('UNIQUE_MARKER=' + uniqueMarker);
}

main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
