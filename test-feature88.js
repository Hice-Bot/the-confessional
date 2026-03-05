const http = require('http');
const { randomUUID } = require('crypto');

function request(method, path, body, headers = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(`http://localhost:3003${path}`);
    const opts = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      method,
      headers: { 'Content-Type': 'application/json', ...headers }
    };
    const req = http.request(opts, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        let parsed;
        try { parsed = JSON.parse(data); } catch { parsed = data; }
        resolve({ status: res.statusCode, body: parsed, headers: res.headers });
      });
    });
    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function main() {
  const ADM = 'Bearer adm_test_key_001';

  // Step 1: POST /confessional/sessions with adm_ auth and valid body
  console.log('=== Step 1: POST /confessional/sessions with adm_ auth and valid body ===');
  const agentId = randomUUID();
  const resp = await request('POST', '/confessional/sessions', { agent_id: agentId }, { Authorization: ADM });
  console.log('Status:', resp.status);
  console.log('Body:', JSON.stringify(resp.body));
  console.log('Status is 200?', resp.status === 200 ? 'PASS' : 'FAIL');

  // Step 2: Verify response contains session_id (UUID format)
  console.log('\n=== Step 2: Verify response contains session_id (UUID format) ===');
  const hasSessionId = resp.body && typeof resp.body.session_id === 'string';
  console.log('Has session_id field?', hasSessionId ? 'PASS' : 'FAIL');
  if (hasSessionId) {
    console.log('session_id value:', resp.body.session_id);
  }

  // Step 3: Verify response contains status field = 'open'
  console.log('\n=== Step 3: Verify response contains status field = "open" ===');
  const statusIsOpen = resp.body && resp.body.status === 'open';
  console.log('Has status field?', resp.body && 'status' in resp.body ? 'PASS' : 'FAIL');
  console.log('Status is "open"?', statusIsOpen ? 'PASS' : 'FAIL');
  console.log('status value:', resp.body.status);

  // Step 4: Verify session_id is a valid UUID
  console.log('\n=== Step 4: Verify session_id is a valid UUID ===');
  const isValidUUID = hasSessionId && UUID_REGEX.test(resp.body.session_id);
  console.log('session_id matches UUID regex?', isValidUUID ? 'PASS' : 'FAIL');
  console.log('UUID regex:', UUID_REGEX.toString());
  console.log('session_id:', resp.body.session_id);

  // Also test a second session to ensure unique UUIDs
  console.log('\n=== Extra: Second session returns different UUID ===');
  const resp2 = await request('POST', '/confessional/sessions', { agent_id: randomUUID() }, { Authorization: ADM });
  console.log('Second session_id:', resp2.body.session_id);
  const differentIds = resp.body.session_id !== resp2.body.session_id;
  console.log('Different from first?', differentIds ? 'PASS' : 'FAIL');

  // Cleanup: close both sessions
  console.log('\n=== Cleanup ===');
  const close1 = await request('POST', `/confessional/sessions/${resp.body.session_id}/close`, null, { Authorization: ADM });
  const close2 = await request('POST', `/confessional/sessions/${resp2.body.session_id}/close`, null, { Authorization: ADM });
  console.log('Session 1 closed:', close1.status);
  console.log('Session 2 closed:', close2.status);

  // Overall result
  console.log('\n=== OVERALL ===');
  const allPass = resp.status === 200 && hasSessionId && statusIsOpen && isValidUUID && differentIds;
  console.log(allPass ? 'ALL STEPS PASS' : 'SOME STEPS FAILED');
}

main().catch(console.error);
