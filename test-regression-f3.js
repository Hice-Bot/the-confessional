const http = require('http');

const ADMIN_KEY = 'adm_test_key_001';
const AGENT_KEY = 'agt_test_key_001';
const BASE = 'http://localhost:3003';
// Use a unique text without numbers to avoid PII scrubbing
const UNIQUE_TEXT = 'REGTEST-PERSIST-WALRUS-FALCON-ORCHID-VELVET-ZEPHYR-KUMQUAT-MANGO';

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
    { agent_id: 'regression-test-agent-persist' },
    { 'Authorization': 'Bearer ' + ADMIN_KEY }
  );
  console.log('   Session status:', sessRes.status);
  if (sessRes.status !== 201 && sessRes.status !== 200) {
    console.log('FAIL: Could not create session, response: ' + JSON.stringify(sessRes.body));
    process.exit(1);
  }
  const sessionId = sessRes.body.session_id || sessRes.body.id;
  console.log('   Session ID:', sessionId);

  // Step 2: Submit a confession
  console.log('2. Submitting confession with text: ' + UNIQUE_TEXT);
  const confRes = await request('POST', '/confessional/submit',
    { text: UNIQUE_TEXT },
    { 'Authorization': 'Bearer ' + AGENT_KEY, 'X-Session-ID': sessionId }
  );
  console.log('   Confession status:', confRes.status);
  if (confRes.status !== 201 && confRes.status !== 200) {
    console.log('FAIL: Could not submit confession, response: ' + JSON.stringify(confRes.body));
    process.exit(1);
  }

  // Step 3: Verify it appears in feed (check multiple pages if needed)
  console.log('3. Checking feed before restart...');
  let found = false;
  let cursor = null;
  let page = 0;
  while (!found && page < 10) {
    const feedUrl = cursor
      ? '/confessional/feed?cursor=' + encodeURIComponent(cursor)
      : '/confessional/feed';
    const feedRes = await request('GET', feedUrl);
    const confessions = feedRes.body.confessions || feedRes.body || [];
    for (const c of confessions) {
      if (c.text === UNIQUE_TEXT) {
        found = true;
        break;
      }
    }
    cursor = feedRes.body.next_cursor;
    page++;
    if (!cursor) break;
  }
  console.log('   Confession found in feed:', found, '(searched', page, 'pages)');
  if (!found) {
    console.log('FAIL: Confession not found in feed before restart');
    process.exit(1);
  }

  console.log('UNIQUE_TEXT=' + UNIQUE_TEXT);
  console.log('PRE-RESTART PASS');
}

main().catch(e => { console.error(e); process.exit(1); });
