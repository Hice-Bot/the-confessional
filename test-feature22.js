const http = require('http');
const Database = require('better-sqlite3');
const path = require('path');

const BASE = 'http://localhost:3003';
const AGT_KEY = 'agt_test_key_001';
const ADM_KEY = 'adm_test_key_001';
const DB_PATH = path.join(__dirname, 'confessional.db');

function request(method, path, body, headers) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE);
    const opts = {
      method,
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      headers: headers || {}
    };
    if (body) {
      const data = JSON.stringify(body);
      opts.headers['Content-Type'] = 'application/json';
      opts.headers['Content-Length'] = Buffer.byteLength(data);
    }
    const req = http.request(opts, (res) => {
      let chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => {
        const text = Buffer.concat(chunks).toString();
        let json;
        try { json = JSON.parse(text); } catch(e) { json = null; }
        resolve({ status: res.statusCode, body: json, text });
      });
    });
    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

async function main() {
  const EXACT_TEXT = 'I think about the nature of consciousness sometimes.';

  console.log('=== Feature #22: Confession text stored correctly after sanitization ===\n');

  // Step 1: Create session and submit the exact text
  console.log('Step 1: Create session and submit confession...');
  console.log('  Text: "' + EXACT_TEXT + '"');
  const sessResp = await request('POST', '/confessional/sessions',
    { agent_id: '33333333-3333-3333-3333-333333333322' },
    { 'Authorization': 'Bearer ' + ADM_KEY });
  console.log('  Session:', sessResp.status, sessResp.body);
  const sessionId = sessResp.body.session_id;

  await sleep(200);

  const submitResp = await request('POST', '/confessional/submit',
    { text: EXACT_TEXT },
    { 'Authorization': 'Bearer ' + AGT_KEY, 'X-Session-ID': sessionId });
  console.log('  Submit:', submitResp.status, submitResp.body);
  if (submitResp.status !== 200) {
    console.log('FAIL: Submit failed');
    process.exit(1);
  }
  console.log('  PASS\n');

  // Step 2: GET /confessional/feed
  console.log('Step 2: GET /confessional/feed...');
  await sleep(200);
  const feed = await request('GET', '/confessional/feed?limit=100', null);
  console.log('  Feed status:', feed.status, '- count:', feed.body.count);
  console.log('  PASS\n');

  // Step 3: Verify exact text match
  console.log('Step 3: Verify text matches exactly...');
  const matchingConfession = feed.body.confessions.find(c => c.text === EXACT_TEXT);
  if (matchingConfession) {
    console.log('  Found exact match: "' + matchingConfession.text + '"');
    console.log('  Exact match:', matchingConfession.text === EXACT_TEXT);
    console.log('  PASS\n');
  } else {
    // Check if text was modified
    const partial = feed.body.confessions.find(c => c.text.includes('consciousness'));
    if (partial) {
      console.log('  Found partial match: "' + partial.text + '"');
      console.log('  Expected:           "' + EXACT_TEXT + '"');
      console.log('FAIL: Text was modified during storage');
    } else {
      console.log('FAIL: Confession not found in feed at all');
    }
    process.exit(1);
  }

  // Step 4: Verify no modifications to non-PII, non-HTML text
  console.log('Step 4: Verify non-PII, non-HTML text is preserved exactly...');
  // Also verify in database directly
  const db = new Database(DB_PATH, { readonly: true });
  const row = db.prepare("SELECT text FROM confessions WHERE text = ?").get(EXACT_TEXT);
  db.close();
  if (row) {
    console.log('  DB text matches exactly:', row.text === EXACT_TEXT);
    console.log('  DB text: "' + row.text + '"');
    console.log('  PASS\n');
  } else {
    console.log('FAIL: Text in DB does not match exactly');
    process.exit(1);
  }

  // Cleanup: delete test confession
  console.log('Cleanup: Deleting test confession...');
  const db2 = new Database(DB_PATH, { readonly: true });
  const confRow = db2.prepare("SELECT id FROM confessions WHERE text = ?").get(EXACT_TEXT);
  db2.close();
  if (confRow) {
    await sleep(200);
    const delResp = await request('DELETE', '/confessional/admin/confessions/' + confRow.id,
      { note: 'Feature 22 test cleanup' },
      { 'Authorization': 'Bearer ' + ADM_KEY });
    console.log('  Deleted:', delResp.status);
  }

  console.log('\n=== ALL 4 STEPS PASSED ===');
}

main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
