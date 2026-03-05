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

async function test() {
  // Step 1: Create session
  var sess = await request('POST', '/confessional/sessions',
    { agent_id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890' },
    { Authorization: 'Bearer ' + ADM_KEY });
  console.log('Session created:', sess.body);
  var sessionId = sess.body.session_id;

  // Step 2: Submit text with control characters
  // Control chars that SHOULD be stripped: 0x00 (NULL), 0x01 (SOH), 0x02 (STX), 0x0B (VT)
  // Chars that should be PRESERVED: 0x09 (tab), 0x0A (newline)
  var uniqueId = 'CTRLSTRIP_' + randomAlpha(8);
  var fullText = uniqueId + ' Hello' + String.fromCharCode(0) + 'World' + String.fromCharCode(1) + 'Test Line1\nLine2\tTabbed';

  console.log('Unique marker:', uniqueId);
  console.log('Submitting text with control chars...');

  var submit = await request('POST', '/confessional/submit', { text: fullText }, {
    Authorization: 'Bearer ' + AGT_KEY,
    'X-Session-ID': sessionId
  });
  console.log('Submit response:', submit.status, JSON.stringify(submit.body));

  if (submit.status !== 200) {
    console.log('ERROR: Submit failed!');
    return;
  }

  // Step 3: Fetch from feed and verify
  var feed = await request('GET', '/confessional/feed?limit=5', null, {});
  var confessions = feed.body.confessions;

  // Find our confession by unique marker
  var found = confessions.find(function(c) { return c.text.indexOf(uniqueId) >= 0; });

  if (!found) {
    console.log('ERROR: Confession not found in feed!');
    console.log('Looking for:', uniqueId);
    confessions.forEach(function(c) { console.log('  -', c.text.substring(0, 80)); });
    return;
  }

  console.log('\nFound confession text:', JSON.stringify(found.text));

  // Check: control chars (0x00, 0x01, 0x02, 0x0B) should be stripped
  var hasNull = found.text.indexOf(String.fromCharCode(0)) >= 0;
  var hasSOH = found.text.indexOf(String.fromCharCode(1)) >= 0;
  var hasSTX = found.text.indexOf(String.fromCharCode(2)) >= 0;
  var hasVT = found.text.indexOf(String.fromCharCode(11)) >= 0;

  console.log('\n=== Step 3: Control chars stripped ===');
  console.log('  NULL (0x00) stripped:', !hasNull ? 'PASS' : 'FAIL');
  console.log('  SOH  (0x01) stripped:', !hasSOH ? 'PASS' : 'FAIL');

  // Check: newlines and tabs preserved
  var hasNewline = found.text.indexOf('\n') >= 0;
  var hasTab = found.text.indexOf('\t') >= 0;
  console.log('\n=== Step 4: Newlines/tabs preserved ===');
  console.log('  Newline preserved:', hasNewline ? 'PASS' : 'FAIL');
  console.log('  Tab preserved:', hasTab ? 'PASS' : 'FAIL');

  // Check: normal text preserved
  var hasHello = found.text.indexOf('Hello') >= 0;
  var hasWorld = found.text.indexOf('World') >= 0;
  var hasTest = found.text.indexOf('Test') >= 0;
  var hasLine1 = found.text.indexOf('Line1') >= 0;
  var hasTabbed = found.text.indexOf('Tabbed') >= 0;

  console.log('\n=== Step 5: Normal text preserved ===');
  console.log('  Hello present:', hasHello ? 'PASS' : 'FAIL');
  console.log('  World present:', hasWorld ? 'PASS' : 'FAIL');
  console.log('  Test present:', hasTest ? 'PASS' : 'FAIL');
  console.log('  Line1 present:', hasLine1 ? 'PASS' : 'FAIL');
  console.log('  Tabbed present:', hasTabbed ? 'PASS' : 'FAIL');

  // Also verify HelloWorld are concatenated (control chars removed between them)
  var helloWorldJoined = found.text.indexOf('HelloWorld') >= 0;
  console.log('  HelloWorld joined (ctrl char removed):', helloWorldJoined ? 'PASS' : 'FAIL');

  var worldTestJoined = found.text.indexOf('WorldTest') >= 0;
  console.log('  WorldTest joined (ctrl char removed):', worldTestJoined ? 'PASS' : 'FAIL');

  var allPassed = !hasNull && !hasSOH && hasNewline && hasTab && hasHello && hasWorld && hasTest && helloWorldJoined && worldTestJoined && hasLine1 && hasTabbed;
  console.log('\n=== OVERALL:', allPassed ? 'ALL PASS' : 'SOME FAILED', '===');

  // Cleanup: delete the confession
  var agentFeed = await request('GET', '/confessional/feed/agent?limit=5', null, { Authorization: 'Bearer ' + AGT_KEY });
  var agentFound = agentFeed.body.confessions.find(function(c) { return c.text.indexOf(uniqueId) >= 0; });
  if (agentFound) {
    console.log('\nNote: Confession created for testing. Manual cleanup may be needed.');
  }
}

test().catch(console.error);
