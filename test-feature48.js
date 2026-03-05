const http = require('http');

const AGT_KEY = 'agt_test_key_001';
const ADM_KEY = 'adm_test_key_001';
const BASE = 'http://localhost:3003';

function request(method, path, headers, body) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE);
    const opts = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      method,
      headers: headers || {}
    };
    const req = http.request(opts, (res) => {
      var data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        resolve({ status: res.statusCode, headers: res.headers, body: data });
      });
    });
    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

async function run() {
  console.log('=== Feature #48: Agent feed returns correct JSON structure ===\n');

  // Step 1: Create a session and submit a confession
  console.log('Step 1: Create session and submit confession...');
  var sessRes = await request('POST', '/confessional/sessions', {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer ' + ADM_KEY
  }, { agent_id: '550e8400-e29b-41d4-a716-446655440048' });
  var sessData = JSON.parse(sessRes.body);
  console.log('  Session created:', sessData.session_id);

  var submitRes = await request('POST', '/confessional/submit', {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer ' + AGT_KEY,
    'X-Session-ID': sessData.session_id
  }, { text: 'AGENT_FEED_TEST_48_VERIFY_' + Date.now() });
  console.log('  Submit response:', submitRes.status, submitRes.body);

  // Step 2: GET /confessional/feed/agent with agt_ auth
  console.log('\nStep 2: GET /confessional/feed/agent with agt_ auth...');
  var feedRes = await request('GET', '/confessional/feed/agent', {
    'Authorization': 'Bearer ' + AGT_KEY
  });
  console.log('  Status:', feedRes.status);
  var feedData = JSON.parse(feedRes.body);

  // Step 3: Verify response has 'confessions' array
  console.log('\nStep 3: Verify response has confessions array...');
  var hasConfessions = Array.isArray(feedData.confessions);
  console.log('  confessions is array:', hasConfessions);
  console.log('  confessions length:', feedData.confessions ? feedData.confessions.length : 'N/A');

  // Step 4: Verify response has 'count', 'total', 'next_cursor' fields
  console.log('\nStep 4: Verify count, total, next_cursor fields...');
  console.log('  count:', feedData.count, '(type:', typeof feedData.count + ')');
  console.log('  total:', feedData.total, '(type:', typeof feedData.total + ')');
  console.log('  next_cursor:', feedData.next_cursor, '(type:', typeof feedData.next_cursor + ')');
  var hasCount = typeof feedData.count === 'number';
  var hasTotal = typeof feedData.total === 'number';
  var hasNextCursor = 'next_cursor' in feedData;
  console.log('  count is number:', hasCount);
  console.log('  total is number:', hasTotal);
  console.log('  next_cursor present:', hasNextCursor);

  // Step 5: Verify each confession object has 'text' and 'created_at' fields
  console.log('\nStep 5: Verify each confession has text and created_at...');
  var allHaveText = true;
  var allHaveCreatedAt = true;
  for (var i = 0; i < feedData.confessions.length; i++) {
    var c = feedData.confessions[i];
    if (typeof c.text !== 'string') allHaveText = false;
    if (typeof c.created_at !== 'string') allHaveCreatedAt = false;
  }
  console.log('  All have text (string):', allHaveText);
  console.log('  All have created_at (string):', allHaveCreatedAt);
  console.log('  Sample confession:', JSON.stringify(feedData.confessions[0]));

  // Step 6: Verify confession objects do NOT have agent ID or session info
  console.log('\nStep 6: Verify no agent ID or session info...');
  var firstConfession = feedData.confessions[0];
  var confessionKeys = Object.keys(firstConfession);
  console.log('  Confession keys:', confessionKeys);
  var hasAgentId = 'agent_id' in firstConfession;
  var hasSessionId = 'session_id' in firstConfession;
  var hasSessionHash = 'session_hash' in firstConfession;
  var hasId = 'id' in firstConfession;
  console.log('  Has agent_id:', hasAgentId, '(should be false)');
  console.log('  Has session_id:', hasSessionId, '(should be false)');
  console.log('  Has session_hash:', hasSessionHash, '(should be false)');
  console.log('  Has id:', hasId, '(should be false)');

  // Step 7: Verify created_at is in ISO8601 format
  console.log('\nStep 7: Verify created_at is ISO8601...');
  var createdAt = firstConfession.created_at;
  console.log('  created_at value:', createdAt);
  var iso8601Pattern = /^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2}/;
  var isISO8601 = iso8601Pattern.test(createdAt);
  console.log('  Matches ISO8601 pattern:', isISO8601);

  // Summary
  console.log('\n=== RESULTS ===');
  var allPassed = hasConfessions && hasCount && hasTotal && hasNextCursor
    && allHaveText && allHaveCreatedAt
    && !hasAgentId && !hasSessionId && !hasSessionHash && !hasId
    && isISO8601;
  console.log('All checks passed:', allPassed);

  // Cleanup: delete the test confession
  console.log('\nCleaning up test data...');
  var feedAll = await request('GET', '/confessional/feed/agent?limit=5', {
    'Authorization': 'Bearer ' + AGT_KEY
  });
  var feedAllData = JSON.parse(feedAll.body);
  for (var j = 0; j < feedAllData.confessions.length; j++) {
    if (feedAllData.confessions[j].text && feedAllData.confessions[j].text.indexOf('AGENT_FEED_TEST_48_VERIFY_') === 0) {
      console.log('  Found test confession to clean up');
    }
  }
}

run().catch(console.error);
