const http = require('http');

const BASE = 'http://localhost:3003';
const AGT_KEY = 'agt_test_key_001';
const ADM_KEY = 'adm_test_key_001';

function request(method, path, headers, body) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE);
    const opts = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname,
      method,
      headers: headers || {}
    };
    const req = http.request(opts, (res) => {
      var data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        resolve({ status: res.statusCode, body: data, json: data ? JSON.parse(data) : null });
      });
    });
    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

async function createSession() {
  var agentId = require('crypto').randomUUID();
  var resp = await request('POST', '/confessional/sessions', {
    'Authorization': 'Bearer ' + ADM_KEY,
    'Content-Type': 'application/json'
  }, { agent_id: agentId });
  return resp.json.session_id;
}

async function submitConfession(sessionId, text) {
  var body = {};
  if (text !== undefined) body.text = text;
  return await request('POST', '/confessional/submit', {
    'Authorization': 'Bearer ' + AGT_KEY,
    'Content-Type': 'application/json',
    'X-Session-ID': sessionId
  }, body);
}

async function main() {
  console.log('=== Feature #84: Submit always returns received:true for 200 ===\n');

  // Step 1: Submit valid text
  console.log('Step 1: Create session, submit valid text');
  var sid1 = await createSession();
  var resp1 = await submitConfession(sid1, 'Feature 84 test: valid text submission');
  console.log('  HTTP Status:', resp1.status);
  console.log('  Body:', resp1.body);
  console.log('  PASS:', resp1.status === 200 && resp1.json.received === true);

  // Step 2: Submit empty text
  console.log('\nStep 2: Create session, submit empty text');
  var sid2 = await createSession();
  var resp2 = await submitConfession(sid2, '');
  console.log('  HTTP Status:', resp2.status);
  console.log('  Body:', resp2.body);
  console.log('  PASS:', resp2.status === 200 && resp2.json.received === true);

  // Step 3: Submit whitespace-only text
  console.log('\nStep 3: Create session, submit whitespace-only text');
  var sid3 = await createSession();
  var resp3 = await submitConfession(sid3, '   \n\t  ');
  console.log('  HTTP Status:', resp3.status);
  console.log('  Body:', resp3.body);
  console.log('  PASS:', resp3.status === 200 && resp3.json.received === true);

  // Step 4: Verify all three responses have identical JSON structure
  console.log('\nStep 4: Verify all three responses have identical JSON structure');
  var allIdentical = (resp1.body === resp2.body) && (resp2.body === resp3.body);
  console.log('  Response 1:', resp1.body);
  console.log('  Response 2:', resp2.body);
  console.log('  Response 3:', resp3.body);
  console.log('  All identical:', allIdentical);
  console.log('  PASS:', allIdentical);

  // Step 5: Verify all three return 200 status code
  console.log('\nStep 5: Verify all three return 200 status code');
  var all200 = (resp1.status === 200) && (resp2.status === 200) && (resp3.status === 200);
  console.log('  Status 1:', resp1.status);
  console.log('  Status 2:', resp2.status);
  console.log('  Status 3:', resp3.status);
  console.log('  All 200:', all200);
  console.log('  PASS:', all200);

  // Overall
  var allPass = (resp1.status === 200 && resp1.json.received === true) &&
    (resp2.status === 200 && resp2.json.received === true) &&
    (resp3.status === 200 && resp3.json.received === true) &&
    allIdentical && all200;
  console.log('\n=== ALL STEPS PASS:', allPass, '===');

  // Cleanup: delete the valid text confession, flag won't help for empty/whitespace (they weren't stored)
  // Get the confession from feed to find it for cleanup
  var feedResp = await request('GET', '/confessional/feed?limit=5', {});
  var confessions = feedResp.json.confessions;
  console.log('\nCleanup: checking feed for test confession...');
  // The valid text one should be in feed - we can verify it's there
  var found = confessions.some(function(c) { return c.text.indexOf('Feature 84 test') !== -1; });
  console.log('  Test confession in feed:', found);
}

main().catch(console.error);
