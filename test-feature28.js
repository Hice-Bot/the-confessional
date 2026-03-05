const http = require('http');

const ADM_KEY = 'adm_test_key_001';
const AGT_KEY = 'agt_test_key_001';
const BASE = 'http://localhost:3003';

function request(method, path, body, headers) {
  headers = headers || {};
  return new Promise(function(resolve, reject) {
    const url = new URL(path, BASE);
    const opts = {
      method: method,
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + (url.search || ''),
      headers: Object.assign({ 'Content-Type': 'application/json' }, headers)
    };
    const req = http.request(opts, function(res) {
      let data = '';
      res.on('data', function(chunk) { data += chunk; });
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

function randomAlpha(len) {
  var chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz';
  var result = '';
  for (var i = 0; i < len; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

function sleep(ms) {
  return new Promise(function(resolve) { setTimeout(resolve, ms); });
}

async function test() {
  var uniqueText = 'FLAG_TEST_AGENT_FEED_' + randomAlpha(8);
  console.log('Unique marker:', uniqueText);

  // Step 1: Create session and submit confession
  var sess = await request('POST', '/confessional/sessions',
    { agent_id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890' },
    { Authorization: 'Bearer ' + ADM_KEY });
  console.log('Session created:', sess.body.session_id);

  var submit = await request('POST', '/confessional/submit', { text: uniqueText }, {
    Authorization: 'Bearer ' + AGT_KEY,
    'X-Session-ID': sess.body.session_id
  });
  console.log('Submit response:', submit.status, JSON.stringify(submit.body));

  // Step 2: Verify it appears in agent feed
  await sleep(100);
  var feed1 = await request('GET', '/confessional/feed/agent?limit=50', null, {
    Authorization: 'Bearer ' + AGT_KEY
  });
  var found1 = feed1.body.confessions.find(function(c) { return c.text.indexOf(uniqueText) >= 0; });
  console.log('\nStep 2 - Confession in agent feed:', found1 ? 'PASS (found)' : 'FAIL (not found)');
  if (found1) {
    console.log('  text:', found1.text);
    console.log('  created_at:', found1.created_at);
  }

  // Get confession ID from database
  var Database = require('better-sqlite3');
  var db = new Database('./confessional.db', { readonly: true });
  var row = db.prepare("SELECT id FROM confessions WHERE text LIKE ?").get('%' + uniqueText + '%');
  db.close();

  if (!row) {
    console.log('ERROR: Could not find confession ID in database');
    return;
  }
  console.log('Confession ID:', row.id);

  // Step 3: Flag the confession via admin API
  await sleep(200);
  var flag = await request('POST', '/confessional/admin/flag',
    { id: row.id, note: 'Testing feature 28 - agent feed flag' },
    { Authorization: 'Bearer ' + ADM_KEY });
  console.log('\nStep 3 - Flag response:', flag.status, JSON.stringify(flag.body));

  // Step 4: Verify it's gone from agent feed
  await sleep(100);
  var feed2 = await request('GET', '/confessional/feed/agent?limit=100', null, {
    Authorization: 'Bearer ' + AGT_KEY
  });
  var found2 = feed2.body.confessions.find(function(c) { return c.text.indexOf(uniqueText) >= 0; });
  console.log('\nStep 4 - Confession hidden from agent feed:', !found2 ? 'PASS (hidden)' : 'FAIL (still visible)');

  var allPassed = found1 && !found2;
  console.log('\n=== OVERALL:', allPassed ? 'ALL PASS' : 'SOME FAILED', '===');

  // Cleanup: delete the test confession
  await sleep(200);
  var del = await request('DELETE', '/confessional/admin/confessions/' + row.id, { note: 'cleanup' }, {
    Authorization: 'Bearer ' + ADM_KEY
  });
  console.log('\nCleanup: deleted confession:', del.status);
}

test().catch(console.error);
