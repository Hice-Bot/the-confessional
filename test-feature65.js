// Test Feature #65: Hard delete removes confession from all feeds
var Database = require('better-sqlite3');
var http = require('http');

var BASE = 'http://localhost:3003';
var AGT_KEY = 'agt_test_key_001';
var ADM_KEY = 'adm_test_key_001';
var UNIQUE_TEXT = 'HARD_DELETE_ALL_FEEDS_zQxWvUtSr_' + Math.random().toString(36).substring(2, 10);

function sleep(ms) { return new Promise(function(r) { setTimeout(r, ms); }); }

function request(method, path, headers, body) {
  return new Promise(function(resolve, reject) {
    var url = new URL(BASE + path);
    var opts = {
      method: method,
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      headers: headers || {}
    };
    var req = http.request(opts, function(res) {
      var data = '';
      res.on('data', function(chunk) { data += chunk; });
      res.on('end', function() {
        resolve({ status: res.statusCode, body: data, json: function() { return JSON.parse(data); } });
      });
    });
    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

async function run() {
  console.log('=== Feature #65: Hard delete removes confession from all feeds ===');
  console.log('Unique text:', UNIQUE_TEXT);

  // Step 1: Create session and submit a confession
  console.log('\n--- Step 1: Create and submit confession ---');
  var sessResp = await request('POST', '/confessional/sessions',
    { 'Authorization': 'Bearer ' + ADM_KEY, 'Content-Type': 'application/json' },
    { agent_id: 'f65-test-uuid' });
  var sessionId = sessResp.json().session_id;
  console.log('Session created:', sessionId);

  await sleep(200);

  var submitResp = await request('POST', '/confessional/submit',
    { 'Authorization': 'Bearer ' + AGT_KEY, 'Content-Type': 'application/json', 'X-Session-ID': sessionId },
    { text: UNIQUE_TEXT });
  console.log('Submit response:', submitResp.status, submitResp.body);

  // Get confession ID from database
  var db = new Database('/mnt/c/Users/turke/the-confessional/confessional.db');
  var row = db.prepare("SELECT id FROM confessions WHERE text LIKE ?").get('%' + UNIQUE_TEXT + '%');
  db.close();
  if (!row) { console.log('FAIL: Confession not found in database'); process.exit(1); }
  var confessionId = row.id;
  console.log('Confession ID:', confessionId);

  await sleep(500);

  // Step 2: Verify it appears in human feed
  console.log('\n--- Step 2: Verify it appears in human feed ---');
  var humanFeed1 = await request('GET', '/confessional/feed?limit=20', {});
  var humanData1 = humanFeed1.json();
  var humanFound1 = humanData1.confessions.some(function(c) { return c.text.includes(UNIQUE_TEXT); });
  console.log('Human feed - total:', humanData1.total, 'found:', humanFound1);
  if (!humanFound1) { console.log('FAIL: Not found in human feed'); process.exit(1); }
  console.log('PASS: Visible in human feed');

  await sleep(500);

  // Step 3: Verify it appears in agent feed
  console.log('\n--- Step 3: Verify it appears in agent feed ---');
  var agentFeed1 = await request('GET', '/confessional/feed/agent?limit=20',
    { 'Authorization': 'Bearer ' + AGT_KEY });
  var agentData1 = agentFeed1.json();
  var agentFound1 = agentData1.confessions.some(function(c) { return c.text.includes(UNIQUE_TEXT); });
  console.log('Agent feed - total:', agentData1.total, 'found:', agentFound1);
  if (!agentFound1) { console.log('FAIL: Not found in agent feed'); process.exit(1); }
  console.log('PASS: Visible in agent feed');

  // Get count before delete
  var countBefore = await request('GET', '/confessional/count', {});
  var countBeforeVal = countBefore.json().count;
  console.log('Count before delete:', countBeforeVal);

  await sleep(500);

  // Step 4: Hard delete with adm_ auth
  console.log('\n--- Step 4: Hard delete confession ---');
  var delResp = await request('DELETE', '/confessional/admin/confessions/' + confessionId,
    { 'Authorization': 'Bearer ' + ADM_KEY, 'Content-Type': 'application/json' },
    { note: 'Feature 65 hard delete test' });
  console.log('Delete response:', delResp.status, delResp.body);
  if (delResp.status !== 200) { console.log('FAIL: Delete did not return 200'); process.exit(1); }
  console.log('PASS: Delete returned 200');

  await sleep(1000);

  // Step 5: Verify gone from human feed
  console.log('\n--- Step 5: Verify gone from human feed ---');
  var humanFeed2 = await request('GET', '/confessional/feed?limit=20', {});
  console.log('Human feed response status received');
  var humanData2 = humanFeed2.json();
  var humanFound2 = humanData2.confessions.some(function(c) { return c.text.includes(UNIQUE_TEXT); });
  console.log('Human feed after delete - total:', humanData2.total, 'found:', humanFound2);
  if (humanFound2) { console.log('FAIL: Still visible in human feed after delete'); process.exit(1); }
  console.log('PASS: Gone from human feed');

  await sleep(500);

  // Step 6: Verify gone from agent feed
  console.log('\n--- Step 6: Verify gone from agent feed ---');
  var agentFeed2 = await request('GET', '/confessional/feed/agent?limit=20',
    { 'Authorization': 'Bearer ' + AGT_KEY });
  var agentData2 = agentFeed2.json();
  var agentFound2 = agentData2.confessions.some(function(c) { return c.text.includes(UNIQUE_TEXT); });
  console.log('Agent feed after delete - total:', agentData2.total, 'found:', agentFound2);
  if (agentFound2) { console.log('FAIL: Still visible in agent feed after delete'); process.exit(1); }
  console.log('PASS: Gone from agent feed');

  await sleep(500);

  // Step 7: Verify count decreased
  console.log('\n--- Step 7: Verify count decreased ---');
  var countAfter = await request('GET', '/confessional/count', {});
  var countAfterVal = countAfter.json().count;
  console.log('Count after delete:', countAfterVal, '(was', countBeforeVal, ')');
  if (countAfterVal >= countBeforeVal) { console.log('FAIL: Count did not decrease'); process.exit(1); }
  console.log('PASS: Count decreased by', countBeforeVal - countAfterVal);

  // Verify row is actually gone from database
  console.log('\n--- Extra: Verify row gone from database ---');
  var db2 = new Database('/mnt/c/Users/turke/the-confessional/confessional.db');
  var gone = db2.prepare("SELECT id FROM confessions WHERE id = ?").get(confessionId);
  db2.close();
  console.log('Row in database:', gone ? 'STILL EXISTS (FAIL)' : 'GONE (PASS)');
  if (gone) { console.log('FAIL: Row still in database after hard delete'); process.exit(1); }

  console.log('\n=== ALL STEPS PASSED for Feature #65 ===');
}

run().catch(function(err) { console.error('Error:', err); process.exit(1); });
