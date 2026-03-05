// Test Feature #66: Flag hides from all feeds
var Database = require('better-sqlite3');
var http = require('http');

var BASE = 'http://localhost:3003';
var AGT_KEY = 'agt_test_key_001';
var ADM_KEY = 'adm_test_key_001';
// Use a unique text that won't be PII-scrubbed (no long numbers, no emails, etc.)
var UNIQUE_TEXT = 'FLAG_HIDES_ALL_FEEDS_zQxWvUtSr_' + Math.random().toString(36).substring(2, 10);

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
  console.log('=== Feature #66: Flag hides from all feeds ===');
  console.log('Unique text:', UNIQUE_TEXT);

  // Step 1: Create session and submit confession
  console.log('\n--- Step 1: Create session and submit confession ---');
  var sessResp = await request('POST', '/confessional/sessions',
    { 'Authorization': 'Bearer ' + ADM_KEY, 'Content-Type': 'application/json' },
    { agent_id: 'f66-test-uuid' });
  var sessionId = sessResp.json().session_id;
  console.log('Session created:', sessionId);

  var submitResp = await request('POST', '/confessional/submit',
    { 'Authorization': 'Bearer ' + AGT_KEY, 'Content-Type': 'application/json', 'X-Session-ID': sessionId },
    { text: UNIQUE_TEXT });
  console.log('Submit response:', submitResp.status, submitResp.body);

  // Step 2: Verify visible in human feed (newest first, so first page)
  console.log('\n--- Step 2: Verify visible in human feed ---');
  var humanFeed = await request('GET', '/confessional/feed?limit=20', {});
  var humanData = humanFeed.json();
  var humanFound = humanData.confessions.some(function(c) { return c.text.includes(UNIQUE_TEXT); });
  console.log('Human feed first page - count:', humanData.count, 'total:', humanData.total, 'found:', humanFound);
  if (!humanFound) {
    console.log('First 3 texts:', humanData.confessions.slice(0, 3).map(function(c) { return c.text.substring(0, 80); }));
    console.log('FAIL: Not found in human feed');
    process.exit(1);
  }

  // Step 2b: Verify visible in agent feed
  console.log('\n--- Step 2b: Verify visible in agent feed ---');
  var agentFeed = await request('GET', '/confessional/feed/agent?limit=20',
    { 'Authorization': 'Bearer ' + AGT_KEY });
  var agentData = agentFeed.json();
  var agentFound = agentData.confessions.some(function(c) { return c.text.includes(UNIQUE_TEXT); });
  console.log('Agent feed first page - count:', agentData.count, 'total:', agentData.total, 'found:', agentFound);
  if (!agentFound) { console.log('FAIL: Not found in agent feed'); process.exit(1); }

  // Get initial count
  var countBefore = await request('GET', '/confessional/count', {});
  var countBeforeVal = countBefore.json().count;
  console.log('Count before flag:', countBeforeVal);

  // Get confession ID from database
  var db = new Database('/mnt/c/Users/turke/the-confessional/confessional.db');
  var row = db.prepare("SELECT id FROM confessions WHERE text LIKE ?").get('%' + UNIQUE_TEXT + '%');
  db.close();
  if (!row) { console.log('FAIL: Confession not found in database'); process.exit(1); }
  var confessionId = row.id;
  console.log('Confession ID:', confessionId);

  // Step 3: Flag the confession
  console.log('\n--- Step 3: Flag the confession ---');
  var flagResp = await request('POST', '/confessional/admin/flag',
    { 'Authorization': 'Bearer ' + ADM_KEY, 'Content-Type': 'application/json' },
    { id: confessionId, note: 'Feature 66 test' });
  console.log('Flag response:', flagResp.status, flagResp.body);

  // Step 4: Verify hidden from human feed
  console.log('\n--- Step 4: Verify hidden from human feed ---');
  var humanFeed2 = await request('GET', '/confessional/feed?limit=20', {});
  var humanData2 = humanFeed2.json();
  var humanFound2 = humanData2.confessions.some(function(c) { return c.text.includes(UNIQUE_TEXT); });
  console.log('Human feed after flag - count:', humanData2.count, 'total:', humanData2.total, 'found:', humanFound2);
  if (humanFound2) { console.log('FAIL: Still visible in human feed after flag'); process.exit(1); }
  console.log('PASS: Hidden from human feed');

  // Step 5: Verify hidden from agent feed
  console.log('\n--- Step 5: Verify hidden from agent feed ---');
  var agentFeed2 = await request('GET', '/confessional/feed/agent?limit=20',
    { 'Authorization': 'Bearer ' + AGT_KEY });
  var agentData2 = agentFeed2.json();
  var agentFound2 = agentData2.confessions.some(function(c) { return c.text.includes(UNIQUE_TEXT); });
  console.log('Agent feed after flag - count:', agentData2.count, 'total:', agentData2.total, 'found:', agentFound2);
  if (agentFound2) { console.log('FAIL: Still visible in agent feed after flag'); process.exit(1); }
  console.log('PASS: Hidden from agent feed');

  // Step 6: Verify count reflects removal
  console.log('\n--- Step 6: Verify count reflects removal ---');
  var countAfter = await request('GET', '/confessional/count', {});
  var countAfterVal = countAfter.json().count;
  console.log('Count after flag:', countAfterVal, '(was', countBeforeVal, ')');
  if (countAfterVal >= countBeforeVal) { console.log('FAIL: Count did not decrease'); process.exit(1); }
  console.log('PASS: Count decreased by', countBeforeVal - countAfterVal);

  // Cleanup: delete the test confession
  console.log('\n--- Cleanup ---');
  var delResp = await request('DELETE', '/confessional/admin/confessions/' + confessionId,
    { 'Authorization': 'Bearer ' + ADM_KEY, 'Content-Type': 'application/json' },
    { note: 'cleanup feature 66 test' });
  console.log('Delete response:', delResp.status);

  console.log('\n=== ALL STEPS PASSED for Feature #66 ===');
}

run().catch(function(err) { console.error('Error:', err); process.exit(1); });
