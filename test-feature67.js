// Test Feature #67: Unflag restores to all feeds
var Database = require('better-sqlite3');
var http = require('http');

var BASE = 'http://localhost:3003';
var AGT_KEY = 'agt_test_key_001';
var ADM_KEY = 'adm_test_key_001';
var UNIQUE_TEXT = 'UNFLAG_RESTORES_FEEDS_zQxWvUtSr_' + Math.random().toString(36).substring(2, 10);

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
  console.log('=== Feature #67: Unflag restores to all feeds ===');
  console.log('Unique text:', UNIQUE_TEXT);

  // Step 1: Create session, submit confession, then flag it
  console.log('\n--- Step 1: Create, submit, and flag confession ---');
  var sessResp = await request('POST', '/confessional/sessions',
    { 'Authorization': 'Bearer ' + ADM_KEY, 'Content-Type': 'application/json' },
    { agent_id: 'f67-test-uuid' });
  var sessionId = sessResp.json().session_id;
  console.log('Session created:', sessionId);

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

  // Flag it
  var flagResp = await request('POST', '/confessional/admin/flag',
    { 'Authorization': 'Bearer ' + ADM_KEY, 'Content-Type': 'application/json' },
    { id: confessionId, note: 'Feature 67 test - flag step' });
  console.log('Flag response:', flagResp.status, flagResp.body);

  // Step 2: Verify hidden from both feeds
  console.log('\n--- Step 2: Verify hidden from both feeds ---');
  var humanFeed1 = await request('GET', '/confessional/feed?limit=20', {});
  var humanData1 = humanFeed1.json();
  var humanHidden = !humanData1.confessions.some(function(c) { return c.text.includes(UNIQUE_TEXT); });
  console.log('Human feed - hidden:', humanHidden, 'total:', humanData1.total);
  if (!humanHidden) { console.log('FAIL: Still visible in human feed after flag'); process.exit(1); }

  var agentFeed1 = await request('GET', '/confessional/feed/agent?limit=20',
    { 'Authorization': 'Bearer ' + AGT_KEY });
  var agentData1 = agentFeed1.json();
  var agentHidden = !agentData1.confessions.some(function(c) { return c.text.includes(UNIQUE_TEXT); });
  console.log('Agent feed - hidden:', agentHidden, 'total:', agentData1.total);
  if (!agentHidden) { console.log('FAIL: Still visible in agent feed after flag'); process.exit(1); }
  console.log('PASS: Hidden from both feeds');

  // Record count while flagged
  var countFlagged = await request('GET', '/confessional/count', {});
  var countFlaggedVal = countFlagged.json().count;
  console.log('Count while flagged:', countFlaggedVal);

  // Step 3: Unflag the confession
  console.log('\n--- Step 3: Unflag the confession ---');
  var unflagResp = await request('POST', '/confessional/admin/unflag',
    { 'Authorization': 'Bearer ' + ADM_KEY, 'Content-Type': 'application/json' },
    { id: confessionId, note: 'Feature 67 test - unflag step' });
  console.log('Unflag response:', unflagResp.status, unflagResp.body);

  // Step 4: Verify reappears in human feed
  console.log('\n--- Step 4: Verify reappears in human feed ---');
  var humanFeed2 = await request('GET', '/confessional/feed?limit=20', {});
  var humanData2 = humanFeed2.json();
  var humanRestored = humanData2.confessions.some(function(c) { return c.text.includes(UNIQUE_TEXT); });
  console.log('Human feed after unflag - total:', humanData2.total, 'found:', humanRestored);
  if (!humanRestored) { console.log('FAIL: Not restored in human feed after unflag'); process.exit(1); }
  console.log('PASS: Restored in human feed');

  // Step 5: Verify reappears in agent feed
  console.log('\n--- Step 5: Verify reappears in agent feed ---');
  var agentFeed2 = await request('GET', '/confessional/feed/agent?limit=20',
    { 'Authorization': 'Bearer ' + AGT_KEY });
  var agentData2 = agentFeed2.json();
  var agentRestored = agentData2.confessions.some(function(c) { return c.text.includes(UNIQUE_TEXT); });
  console.log('Agent feed after unflag - total:', agentData2.total, 'found:', agentRestored);
  if (!agentRestored) { console.log('FAIL: Not restored in agent feed after unflag'); process.exit(1); }
  console.log('PASS: Restored in agent feed');

  // Step 6: Verify count increased back
  console.log('\n--- Step 6: Verify count increased back ---');
  var countAfter = await request('GET', '/confessional/count', {});
  var countAfterVal = countAfter.json().count;
  console.log('Count after unflag:', countAfterVal, '(was', countFlaggedVal, 'while flagged)');
  if (countAfterVal <= countFlaggedVal) { console.log('FAIL: Count did not increase after unflag'); process.exit(1); }
  console.log('PASS: Count increased by', countAfterVal - countFlaggedVal);

  // Cleanup
  console.log('\n--- Cleanup ---');
  var delResp = await request('DELETE', '/confessional/admin/confessions/' + confessionId,
    { 'Authorization': 'Bearer ' + ADM_KEY, 'Content-Type': 'application/json' },
    { note: 'cleanup feature 67 test' });
  console.log('Delete response:', delResp.status);

  console.log('\n=== ALL STEPS PASSED for Feature #67 ===');
}

run().catch(function(err) { console.error('Error:', err); process.exit(1); });
