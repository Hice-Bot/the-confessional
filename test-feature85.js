const http = require('http');
const crypto = require('crypto');

const BASE = 'http://localhost:3003';
const AGT_KEY = 'agt_test_key_001';
const ADM_KEY = 'adm_test_key_001';

function request(method, path, headers, body) {
  return new Promise((resolve, reject) => {
    var url = new URL(path, BASE);
    var opts = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname,
      method,
      headers: headers || {}
    };
    var req = http.request(opts, (res) => {
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
  var agentId = crypto.randomUUID();
  var resp = await request('POST', '/confessional/sessions', {
    'Authorization': 'Bearer ' + ADM_KEY,
    'Content-Type': 'application/json'
  }, { agent_id: agentId });
  return resp.json.session_id;
}

async function main() {
  console.log('=== Feature #85: Error responses include error field ===\n');

  // Step 1: Submit without auth → verify response has error field
  console.log('Step 1: Submit without auth');
  var resp1 = await request('POST', '/confessional/submit', {
    'Content-Type': 'application/json'
  }, { text: 'test' });
  console.log('  HTTP Status:', resp1.status);
  console.log('  Body:', resp1.body);
  console.log('  Has error field:', resp1.json && typeof resp1.json.error === 'string');
  console.log('  Error message:', resp1.json ? resp1.json.error : 'N/A');
  var pass1 = resp1.status === 401 && resp1.json && typeof resp1.json.error === 'string' && resp1.json.error.length > 0;
  console.log('  PASS:', pass1);

  // Step 2: Submit with invalid (nonexistent) session → verify error field exists
  console.log('\nStep 2: Submit with invalid session');
  var resp2 = await request('POST', '/confessional/submit', {
    'Authorization': 'Bearer ' + AGT_KEY,
    'Content-Type': 'application/json',
    'X-Session-ID': 'nonexistent-session-id-fake'
  }, { text: 'test' });
  console.log('  HTTP Status:', resp2.status);
  console.log('  Body:', resp2.body);
  console.log('  Has error field:', resp2.json && typeof resp2.json.error === 'string');
  console.log('  Error message:', resp2.json ? resp2.json.error : 'N/A');
  var pass2 = resp2.status === 404 && resp2.json && typeof resp2.json.error === 'string' && resp2.json.error.length > 0;
  console.log('  PASS:', pass2);

  // Step 3: Submit duplicate → verify error field exists
  console.log('\nStep 3: Submit duplicate (same session twice)');
  var sid3 = await createSession();
  await request('POST', '/confessional/submit', {
    'Authorization': 'Bearer ' + AGT_KEY,
    'Content-Type': 'application/json',
    'X-Session-ID': sid3
  }, { text: 'Feature 85 first submission' });

  var resp3 = await request('POST', '/confessional/submit', {
    'Authorization': 'Bearer ' + AGT_KEY,
    'Content-Type': 'application/json',
    'X-Session-ID': sid3
  }, { text: 'Feature 85 duplicate submission' });
  console.log('  HTTP Status:', resp3.status);
  console.log('  Body:', resp3.body);
  console.log('  Has error field:', resp3.json && typeof resp3.json.error === 'string');
  console.log('  Error message:', resp3.json ? resp3.json.error : 'N/A');
  var pass3 = resp3.status === 409 && resp3.json && typeof resp3.json.error === 'string' && resp3.json.error.length > 0;
  console.log('  PASS:', pass3);

  // Step 4: Submit exceeding length → verify error field exists
  console.log('\nStep 4: Submit exceeding 2000 char length');
  var sid4 = await createSession();
  var longText = 'A'.repeat(2001);
  var resp4 = await request('POST', '/confessional/submit', {
    'Authorization': 'Bearer ' + AGT_KEY,
    'Content-Type': 'application/json',
    'X-Session-ID': sid4
  }, { text: longText });
  console.log('  HTTP Status:', resp4.status);
  console.log('  Body:', resp4.body);
  console.log('  Has error field:', resp4.json && typeof resp4.json.error === 'string');
  console.log('  Error message:', resp4.json ? resp4.json.error : 'N/A');
  var pass4 = resp4.status === 400 && resp4.json && typeof resp4.json.error === 'string' && resp4.json.error.length > 0;
  console.log('  PASS:', pass4);

  // Step 5: Each error message should be descriptive
  console.log('\nStep 5: Verify each error message is descriptive (>10 chars)');
  var errors = [
    { step: 1, msg: resp1.json ? resp1.json.error : '' },
    { step: 2, msg: resp2.json ? resp2.json.error : '' },
    { step: 3, msg: resp3.json ? resp3.json.error : '' },
    { step: 4, msg: resp4.json ? resp4.json.error : '' }
  ];
  var allDescriptive = true;
  errors.forEach(function(e) {
    var descriptive = e.msg.length > 10;
    console.log('  Step ' + e.step + ': "' + e.msg + '" (length=' + e.msg.length + ', descriptive=' + descriptive + ')');
    if (!descriptive) allDescriptive = false;
  });
  console.log('  PASS:', allDescriptive);

  var allPass = pass1 && pass2 && pass3 && pass4 && allDescriptive;
  console.log('\n=== ALL STEPS PASS:', allPass, '===');
}

main().catch(console.error);
