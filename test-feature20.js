const http = require('http');

const BASE = 'http://localhost:3003';
const AGT_KEY = 'agt_test_key_001';
const ADM_KEY = 'adm_test_key_001';

function request(method, path, body, headers = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE);
    const opts = {
      method,
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      headers: { ...headers }
    };
    if (body) {
      const data = JSON.stringify(body);
      opts.headers['Content-Type'] = 'application/json';
      opts.headers['Content-Length'] = Buffer.byteLength(data);
    }
    const req = http.request(opts, (res) => {
      let chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => {
        const text = Buffer.concat(chunks).toString();
        let json;
        try { json = JSON.parse(text); } catch(e) { json = null; }
        resolve({ status: res.statusCode, body: json, text });
      });
    });
    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

async function main() {
  const UNIQUE_TEXT = 'PERSIST_TEST_789_FEAT20_XYQWZ';

  console.log('=== Feature #20: Confession persists after re-request ===\n');

  // Step 1: Create session and submit confession
  console.log('Step 1: Create session and submit confession...');
  const sessResp = await request('POST', '/confessional/sessions',
    { agent_id: '11111111-1111-1111-1111-111111111120' },
    { 'Authorization': `Bearer ${ADM_KEY}` });
  console.log('  Session created:', sessResp.status, sessResp.body);
  const sessionId = sessResp.body.session_id;

  const submitResp = await request('POST', '/confessional/submit',
    { text: UNIQUE_TEXT },
    { 'Authorization': `Bearer ${AGT_KEY}`, 'X-Session-ID': sessionId });
  console.log('  Submit response:', submitResp.status, submitResp.body);

  if (submitResp.status !== 200 || !submitResp.body.received) {
    console.log('FAIL: Submit did not return 200 with received:true');
    process.exit(1);
  }
  console.log('  PASS: Confession submitted successfully\n');

  // Step 2: GET /confessional/feed - verify confession appears
  console.log('Step 2: GET /confessional/feed - verify confession appears...');
  const feed1 = await request('GET', '/confessional/feed?limit=100', null);
  console.log('  Feed status:', feed1.status, '- count:', feed1.body.count);
  const found1 = feed1.body.confessions.some(c => c.text === UNIQUE_TEXT);
  console.log('  Confession found in feed:', found1);
  if (!found1) {
    console.log('FAIL: Confession not found in first feed request');
    process.exit(1);
  }
  console.log('  PASS: Confession appears in feed\n');

  // Step 3: Wait 1 second
  console.log('Step 3: Waiting 1 second...');
  await new Promise(resolve => setTimeout(resolve, 1000));
  console.log('  Done waiting\n');

  // Step 4: GET /confessional/feed again - verify same confession still appears
  console.log('Step 4: GET /confessional/feed again - verify confession persists...');
  const feed2 = await request('GET', '/confessional/feed?limit=100', null);
  console.log('  Feed status:', feed2.status, '- count:', feed2.body.count);
  const found2 = feed2.body.confessions.some(c => c.text === UNIQUE_TEXT);
  console.log('  Confession still in feed:', found2);
  if (!found2) {
    console.log('FAIL: Confession disappeared after 1 second');
    process.exit(1);
  }
  console.log('  PASS: Confession persists after re-request\n');

  // Step 5: GET /confessional/count - verify count includes this confession
  console.log('Step 5: GET /confessional/count - verify count includes confession...');
  const countResp = await request('GET', '/confessional/count', null);
  console.log('  Count response:', countResp.status, countResp.body);
  if (countResp.body.count < 1) {
    console.log('FAIL: Count is 0, confession not counted');
    process.exit(1);
  }
  console.log('  PASS: Count includes confession (count=' + countResp.body.count + ')\n');

  // Cleanup: delete the test confession
  console.log('Cleanup: Finding and deleting test confession...');
  const agentFeed = await request('GET', '/confessional/feed/agent?limit=100', null,
    { 'Authorization': `Bearer ${AGT_KEY}` });
  // Agent feed doesn't have IDs... let's use DB query approach
  // Actually, we need to find confession ID. Let's check if human feed has it... no it doesn't.
  // Let's just leave cleanup for now or query via agent feed
  console.log('  Note: Test data left in DB (no ID exposed in feeds for cleanup)');

  console.log('\n=== ALL STEPS PASSED ===');
}

main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
