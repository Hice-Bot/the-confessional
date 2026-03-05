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
  const UNIQUE_TEXT = 'DELETE_ME_TEST_456_FEAT21_ZQRWX';

  console.log('=== Feature #21: Deleted confession disappears from feed ===\n');

  // Step 1: Create session and submit confession
  console.log('Step 1: Create session, submit confession with unique text...');
  const sessResp = await request('POST', '/confessional/sessions',
    { agent_id: '22222222-2222-2222-2222-222222222221' },
    { 'Authorization': 'Bearer ' + ADM_KEY });
  console.log('  Session:', sessResp.status, sessResp.body);
  const sessionId = sessResp.body.session_id;

  await sleep(200);

  const submitResp = await request('POST', '/confessional/submit',
    { text: UNIQUE_TEXT },
    { 'Authorization': 'Bearer ' + AGT_KEY, 'X-Session-ID': sessionId });
  console.log('  Submit:', submitResp.status, submitResp.body);
  if (submitResp.status !== 200) {
    console.log('FAIL: Submit failed');
    process.exit(1);
  }
  console.log('  PASS\n');

  // Step 2: Verify confession appears in human feed
  console.log('Step 2: GET /confessional/feed - verify confession appears...');
  await sleep(200);
  const feed1 = await request('GET', '/confessional/feed?limit=100', null);
  const found1 = feed1.body.confessions.some(c => c.text === UNIQUE_TEXT);
  console.log('  Found in human feed:', found1);
  if (!found1) {
    console.log('FAIL: Confession not in human feed');
    process.exit(1);
  }
  const countBefore = feed1.body.total;
  console.log('  Total before delete:', countBefore);
  console.log('  PASS\n');

  // Step 3: Query confessions table to get the confession ID
  console.log('Step 3: Query confessions table for confession ID...');
  const db = new Database(DB_PATH, { readonly: true });
  const row = db.prepare("SELECT id, text FROM confessions WHERE text = ?").get(UNIQUE_TEXT);
  db.close();
  if (!row) {
    console.log('FAIL: Confession not found in DB');
    process.exit(1);
  }
  console.log('  Found confession ID:', row.id);
  console.log('  PASS\n');

  // Step 4: DELETE /confessional/admin/confessions/:id
  console.log('Step 4: DELETE /confessional/admin/confessions/' + row.id + '...');
  await sleep(200);
  const delResp = await request('DELETE', '/confessional/admin/confessions/' + row.id,
    { note: 'Feature 21 test cleanup' },
    { 'Authorization': 'Bearer ' + ADM_KEY });
  console.log('  Delete response:', delResp.status, delResp.body);
  if (delResp.status !== 200) {
    console.log('FAIL: Delete failed with status ' + delResp.status);
    process.exit(1);
  }
  console.log('  PASS\n');

  // Step 5: Verify gone from human feed
  console.log('Step 5: GET /confessional/feed - verify confession gone...');
  await sleep(200);
  const feed2 = await request('GET', '/confessional/feed?limit=100', null);
  const found2 = feed2.body.confessions.some(c => c.text === UNIQUE_TEXT);
  console.log('  Found in human feed:', found2);
  if (found2) {
    console.log('FAIL: Confession still in human feed after delete');
    process.exit(1);
  }
  console.log('  PASS\n');

  // Step 6: Verify gone from agent feed
  console.log('Step 6: GET /confessional/feed/agent - verify gone from agent feed...');
  await sleep(200);
  const agentFeed = await request('GET', '/confessional/feed/agent?limit=100', null,
    { 'Authorization': 'Bearer ' + AGT_KEY });
  const found3 = agentFeed.body.confessions.some(c => c.text === UNIQUE_TEXT);
  console.log('  Found in agent feed:', found3);
  if (found3) {
    console.log('FAIL: Confession still in agent feed after delete');
    process.exit(1);
  }
  console.log('  PASS\n');

  // Step 7: Verify count decreased
  console.log('Step 7: GET /confessional/count - verify count decreased...');
  await sleep(200);
  const countResp = await request('GET', '/confessional/count', null);
  const countAfter = countResp.body.count;
  console.log('  Count before:', countBefore, '- Count after:', countAfter);
  if (countAfter >= countBefore) {
    console.log('FAIL: Count did not decrease');
    process.exit(1);
  }
  console.log('  Count decreased by', countBefore - countAfter);
  console.log('  PASS\n');

  console.log('=== ALL 7 STEPS PASSED ===');
}

main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
