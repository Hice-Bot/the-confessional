const http = require('http');
const fs = require('fs');

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
      headers: { 'Content-Type': 'application/json', ...headers },
    };
    const req = http.request(opts, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
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

const phase = process.argv[2]; // 'pre' or 'post'

async function preRestart() {
  console.log('=== PRE-RESTART: Setting up test data ===\n');

  // Use a unique marker that won't be PII-scrubbed (no long numbers)
  const marker = 'PERSIST-REGTEST-ZEBRA-TULIP-NEPTUNE-QUARTZ';

  // Step 1: Create session
  console.log('Creating session...');
  const sessionRes = await request('POST', '/confessional/sessions',
    { agent_id: 'persist-test-agent' },
    { Authorization: 'Bearer ' + ADM_KEY }
  );
  console.log('  Session status:', sessionRes.status);
  const sessionId = sessionRes.body.session_id || sessionRes.body.id;
  console.log('  Session ID:', sessionId);

  if (!sessionId) {
    console.log('FAIL: No session ID returned');
    process.exit(1);
  }

  // Step 2: Submit confession
  console.log('\nSubmitting confession with marker:', marker);
  const submitRes = await request('POST', '/confessional/submit',
    { text: marker },
    { Authorization: 'Bearer ' + AGT_KEY, 'X-Session-ID': sessionId }
  );
  console.log('  Submit status:', submitRes.status);
  console.log('  Submit body:', JSON.stringify(submitRes.body));

  if (submitRes.status !== 201 && submitRes.status !== 200) {
    console.log('FAIL: Submission failed');
    process.exit(1);
  }

  // Step 3: Verify in feed before restart
  console.log('\nVerifying confession in feed...');
  const feedRes = await request('GET', '/confessional/feed');
  const confessions = feedRes.body.confessions || [];
  const found = confessions.some(c => c.text === marker);
  console.log('  Found in feed:', found);

  if (!found) {
    console.log('  Checking if it appears with sanitization...');
    const partial = confessions.filter(c => c.text.includes('PERSIST-REGTEST-ZEBRA'));
    console.log('  Partial matches:', partial.length);
    partial.forEach(c => console.log('    -', c.text));
    if (partial.length === 0) {
      console.log('FAIL: Confession not found in feed before restart');
      process.exit(1);
    }
  }

  // Save marker for post-restart check
  fs.writeFileSync('test-regression-f3-marker.txt', marker);
  console.log('\n=== PRE-RESTART PASSED. Marker saved. ===');
}

async function postRestart() {
  console.log('=== POST-RESTART: Verifying persistence ===\n');

  const marker = fs.readFileSync('test-regression-f3-marker.txt', 'utf8').trim();
  console.log('Looking for marker:', marker);

  // Check feed
  const feedRes = await request('GET', '/confessional/feed');
  console.log('Feed status:', feedRes.status);

  if (feedRes.status !== 200) {
    console.log('FAIL: Feed returned non-200 status');
    process.exit(1);
  }

  const confessions = feedRes.body.confessions || [];
  console.log('Confessions in page:', confessions.length);
  console.log('Total confessions:', feedRes.body.total);

  const found = confessions.some(c => c.text === marker);
  console.log('Exact match found:', found);

  if (!found) {
    // Check partial (in case of any sanitization)
    const partial = confessions.filter(c => c.text.includes('PERSIST-REGTEST-ZEBRA'));
    console.log('Partial matches:', partial.length);
    partial.forEach(c => console.log('  -', c.text));
    if (partial.length > 0) {
      console.log('\n=== POST-RESTART PASSED (with sanitization) ===');
    } else {
      console.log('FAIL: Confession not found after restart');
      process.exit(1);
    }
  } else {
    console.log('\n=== POST-RESTART PASSED (exact match) ===');
  }
}

if (phase === 'pre') {
  preRestart().catch(err => { console.error('ERROR:', err.message); process.exit(1); });
} else if (phase === 'post') {
  postRestart().catch(err => { console.error('ERROR:', err.message); process.exit(1); });
} else {
  console.log('Usage: node test-regression-f3-full.js [pre|post]');
  process.exit(1);
}
