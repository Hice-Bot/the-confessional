var http = require('http');
var crypto = require('crypto');

function request(method, path, headers, body) {
  return new Promise(function(resolve, reject) {
    var opts = { hostname: 'localhost', port: 3003, path: path, method: method, headers: headers || {} };
    var req = http.request(opts, function(res) {
      var data = '';
      res.on('data', function(d) { data += d; });
      res.on('end', function() { resolve({ status: res.statusCode, body: data }); });
    });
    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

async function main() {
  // Step 1: Create session
  var agentId = crypto.randomUUID();
  var sessResp = await request('POST', '/confessional/sessions',
    { 'Content-Type': 'application/json', 'Authorization': 'Bearer adm_test_key_001' },
    { agent_id: agentId });
  var sessData = JSON.parse(sessResp.body);
  console.log('Session created:', sessData.session_id);

  // Step 2: Submit confession
  var submitResp = await request('POST', '/confessional/submit',
    { 'Content-Type': 'application/json', 'Authorization': 'Bearer agt_test_key_001', 'X-Session-ID': sessData.session_id },
    { text: 'TIMESTAMP_TEST_F98_' + Date.now() });
  console.log('Submit response:', submitResp.body, 'Status:', submitResp.status);

  // Step 3: Get agent feed
  var feedResp = await request('GET', '/confessional/feed/agent',
    { 'Authorization': 'Bearer agt_test_key_001' });
  var feedData = JSON.parse(feedResp.body);

  // Check first 5 confessions for ISO8601 timestamps
  var iso8601Pattern = /^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2}/;
  var confessions = feedData.confessions.slice(0, 5);

  console.log('\n=== Timestamp Verification ===');
  var allValid = true;
  for (var i = 0; i < confessions.length; i++) {
    var c = confessions[i];
    var ts = c.created_at;
    var matchesPattern = iso8601Pattern.test(ts);
    var parsedDate = new Date(ts);
    var isParseable = !isNaN(parsedDate.getTime());
    console.log('Confession ' + (i+1) + ': created_at=' + ts + ', ISO8601=' + matchesPattern + ', parseable=' + isParseable);
    if (!matchesPattern || !isParseable) allValid = false;
  }

  console.log('\nAll timestamps valid ISO8601:', allValid);
  console.log('Sample timestamp:', confessions[0] ? confessions[0].created_at : 'none');

  // Verify YYYY-MM-DD format specifically
  var strictIso = /^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2}/;
  var sampleTs = confessions[0] ? confessions[0].created_at : '';
  console.log('\nStrict ISO8601 check on sample:');
  console.log('  Value:', sampleTs);
  console.log('  Matches YYYY-MM-DD[T]HH:MM:SS:', strictIso.test(sampleTs));

  // Check health endpoint timestamp too
  var healthResp = await request('GET', '/api/health', {});
  var healthData = JSON.parse(healthResp.body);
  console.log('\nHealth endpoint timestamp:', healthData.timestamp);
  console.log('Health ISO8601:', iso8601Pattern.test(healthData.timestamp));

  // Cleanup: delete the test confession
  // Find it in the feed
  var testConfession = feedData.confessions.find(function(c) { return c.text && c.text.startsWith('TIMESTAMP_TEST_F98_'); });
  if (testConfession) {
    console.log('\nTest confession found in feed (text starts with TIMESTAMP_TEST_F98_)');
  }

  // Close the session
  await request('POST', '/confessional/sessions/' + sessData.session_id + '/close',
    { 'Content-Type': 'application/json', 'Authorization': 'Bearer adm_test_key_001' });
  console.log('Session closed');

  console.log('\n=== Feature #98 Result ===');
  console.log(allValid ? 'PASS: All timestamps are valid ISO8601' : 'FAIL: Some timestamps are not valid ISO8601');
}

main().catch(console.error);
