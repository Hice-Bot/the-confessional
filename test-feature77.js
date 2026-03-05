const http = require('http');

const ADM_KEY = 'adm_test_key_001';
const AGT_KEY = 'agt_test_key_001';
const BASE = 'localhost';
const PORT = 3003;

function makeRequest(method, path, headers, body) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : null;
    const opts = {
      hostname: BASE,
      port: PORT,
      path,
      method,
      headers: { ...headers }
    };
    if (data) {
      opts.headers['Content-Length'] = Buffer.byteLength(data);
    }
    const req = http.request(opts, (res) => {
      let responseBody = '';
      res.on('data', (chunk) => responseBody += chunk);
      res.on('end', () => resolve({ status: res.statusCode, body: responseBody }));
    });
    req.on('error', reject);
    if (data) req.write(data);
    req.end();
  });
}

async function createSession(agentId) {
  const res = await makeRequest('POST', '/confessional/sessions', {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer ' + ADM_KEY
  }, { agent_id: agentId });
  const parsed = JSON.parse(res.body);
  return parsed.session_id;
}

async function submitConfession(sessionId, text) {
  return makeRequest('POST', '/confessional/submit', {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer ' + AGT_KEY,
    'X-Session-ID': sessionId
  }, { text });
}

async function cleanupConfession(sessionId) {
  const crypto = require('crypto');
  const sessionHash = crypto.createHash('sha256').update(sessionId).digest('hex');
  const Database = require('better-sqlite3');
  const db = new Database('./confessional.db');
  db.prepare('DELETE FROM confessions WHERE session_hash = ?').run(sessionHash);
  db.prepare('DELETE FROM session_attempts WHERE session_hash = ?').run(sessionHash);
  db.close();
}

async function cleanupSession(sessionId) {
  const Database = require('better-sqlite3');
  const db = new Database('./confessional.db');
  db.prepare('DELETE FROM sessions WHERE id = ?').run(sessionId);
  db.close();
}

async function run() {
  const sessions = [];

  try {
    // Step 1: Submit exactly 2000 characters → expect 200
    console.log('=== Step 1: Submit exactly 2000 characters ===');
    const sid1 = await createSession('77777777-0001-0001-0001-000000000001');
    sessions.push(sid1);
    const text2000 = 'A'.repeat(2000);
    console.log('Text length:', text2000.length);
    const res1 = await submitConfession(sid1, text2000);
    console.log('Status:', res1.status, '(expected 200)');
    console.log('Body:', res1.body);
    console.log(res1.status === 200 ? 'PASS' : 'FAIL');

    // Step 2: Submit 2001 characters → expect 400
    console.log('\n=== Step 2: Submit 2001 characters ===');
    const sid2 = await createSession('77777777-0002-0002-0002-000000000002');
    sessions.push(sid2);
    const text2001 = 'B'.repeat(2001);
    console.log('Text length:', text2001.length);
    const res2 = await submitConfession(sid2, text2001);
    console.log('Status:', res2.status, '(expected 400)');
    console.log('Body:', res2.body);
    console.log(res2.status === 400 ? 'PASS' : 'FAIL');

    // Step 3: Submit 1 character → expect 200 (stored)
    console.log('\n=== Step 3: Submit 1 character ===');
    const sid3 = await createSession('77777777-0003-0003-0003-000000000003');
    sessions.push(sid3);
    const text1 = 'X';
    console.log('Text length:', text1.length);
    const res3 = await submitConfession(sid3, text1);
    console.log('Status:', res3.status, '(expected 200)');
    console.log('Body:', res3.body);
    console.log(res3.status === 200 ? 'PASS' : 'FAIL');

    // Step 4: Verify boundary is strictly at 2000
    console.log('\n=== Step 4: Verify boundary is strictly enforced at 2000 ===');
    console.log('2000 chars → 200:', res1.status === 200 ? 'PASS' : 'FAIL');
    console.log('2001 chars → 400:', res2.status === 400 ? 'PASS' : 'FAIL');
    console.log('1 char → 200:', res3.status === 200 ? 'PASS' : 'FAIL');

    const allPass = res1.status === 200 && res2.status === 400 && res3.status === 200;
    console.log('\nOVERALL:', allPass ? 'ALL PASS' : 'SOME FAILED');

  } finally {
    // Cleanup
    console.log('\n=== Cleanup ===');
    for (const sid of sessions) {
      try { await cleanupConfession(sid); } catch(e) {}
      try { await cleanupSession(sid); } catch(e) {}
    }
    console.log('Cleanup done');
  }
}

run().catch(console.error);
