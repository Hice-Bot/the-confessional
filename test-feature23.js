const http = require('http');

const AGT_KEY = 'agt_test_key_001';
const ADM_KEY = 'adm_test_key_001';
const BASE = 'http://localhost:3003';

function request(method, path, body, headers = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE);
    const opts = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      method,
      headers: { ...headers }
    };
    if (body) {
      const data = JSON.stringify(body);
      opts.headers['Content-Type'] = 'application/json';
      opts.headers['Content-Length'] = Buffer.byteLength(data);
    }
    const req = http.request(opts, (res) => {
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => {
        const text = Buffer.concat(chunks).toString();
        try { resolve({ status: res.statusCode, body: JSON.parse(text) }); }
        catch { resolve({ status: res.statusCode, body: text }); }
      });
    });
    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

function uuid() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = Math.random() * 16 | 0;
    return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
  });
}

// Use purely alpha markers to avoid PII scrubber treating numbers as phone numbers
function alphaMarker(prefix) {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  const suffix = Array.from({length: 8}, () => chars[Math.floor(Math.random() * chars.length)]).join('');
  return prefix + suffix;
}

async function createSessionAndSubmit(text) {
  const agentId = uuid();
  const sessResp = await request('POST', '/confessional/sessions', { agent_id: agentId }, {
    'Authorization': 'Bearer ' + ADM_KEY
  });
  console.log('  Session created:', sessResp.status, sessResp.body.session_id);

  await new Promise(r => setTimeout(r, 500));

  const submitResp = await request('POST', '/confessional/submit', { text }, {
    'Authorization': 'Bearer ' + AGT_KEY,
    'X-Session-ID': sessResp.body.session_id
  });
  console.log('  Submit:', submitResp.status, JSON.stringify(submitResp.body));
  return sessResp.body.session_id;
}

async function findConfessionByMarker(marker) {
  // Search through paginated feed to find confession
  const resp = await request('GET', '/confessional/feed?limit=100', null);
  if (resp.body && resp.body.confessions) {
    const found = resp.body.confessions.find(c => c.text.includes(marker));
    return found;
  }
  return null;
}

async function run() {
  const results = [];
  const markers = [];

  // Test 1: Email PII scrubbing
  console.log('\n=== Test 1: Email PII scrubbing ===');
  const emailMarker = alphaMarker('EMAILTEST');
  markers.push(emailMarker);
  await createSessionAndSubmit('Contact me at test@example.com for details ' + emailMarker);
  await new Promise(r => setTimeout(r, 500));

  const emailConfession = await findConfessionByMarker(emailMarker);
  if (emailConfession) {
    const hasEmail = emailConfession.text.includes('test@example.com');
    const hasRedacted = emailConfession.text.includes('[redacted]');
    console.log('  Email in text:', hasEmail, '(should be false)');
    console.log('  [redacted] in text:', hasRedacted, '(should be true)');
    console.log('  Full text:', emailConfession.text);
    results.push({ test: 'Email PII scrubbed', pass: !hasEmail && hasRedacted });
  } else {
    console.log('  ERROR: Confession with marker not found in feed!');
    results.push({ test: 'Email PII scrubbed', pass: false });
  }

  // Test 2: Phone PII scrubbing
  console.log('\n=== Test 2: Phone PII scrubbing ===');
  const phoneMarker = alphaMarker('PHONETEST');
  markers.push(phoneMarker);
  await new Promise(r => setTimeout(r, 500));
  await createSessionAndSubmit('Call me at 555-123-4567 ' + phoneMarker);
  await new Promise(r => setTimeout(r, 500));

  const phoneConfession = await findConfessionByMarker(phoneMarker);
  if (phoneConfession) {
    const hasPhone = phoneConfession.text.includes('555-123-4567');
    const hasRedacted = phoneConfession.text.includes('[redacted]');
    console.log('  Phone in text:', hasPhone, '(should be false)');
    console.log('  [redacted] in text:', hasRedacted, '(should be true)');
    console.log('  Full text:', phoneConfession.text);
    results.push({ test: 'Phone PII scrubbed', pass: !hasPhone && hasRedacted });
  } else {
    console.log('  ERROR: Confession with marker not found in feed!');
    results.push({ test: 'Phone PII scrubbed', pass: false });
  }

  // Test 3: IP Address PII scrubbing
  console.log('\n=== Test 3: IP Address PII scrubbing ===');
  const ipMarker = alphaMarker('IPTEST');
  markers.push(ipMarker);
  await new Promise(r => setTimeout(r, 500));
  await createSessionAndSubmit('My IP is 192.168.1.1 ' + ipMarker);
  await new Promise(r => setTimeout(r, 500));

  const ipConfession = await findConfessionByMarker(ipMarker);
  if (ipConfession) {
    const hasIP = ipConfession.text.includes('192.168.1.1');
    const hasRedacted = ipConfession.text.includes('[redacted]');
    console.log('  IP in text:', hasIP, '(should be false)');
    console.log('  [redacted] in text:', hasRedacted, '(should be true)');
    console.log('  Full text:', ipConfession.text);
    results.push({ test: 'IP PII scrubbed', pass: !hasIP && hasRedacted });
  } else {
    console.log('  ERROR: Confession with marker not found in feed!');
    results.push({ test: 'IP PII scrubbed', pass: false });
  }

  // Test 4: Verify PII never stored in DB directly
  console.log('\n=== Test 4: Direct DB verification ===');
  const Database = require('better-sqlite3');
  const db = new Database('./confessional.db', { readonly: true });

  const emailInDb = db.prepare("SELECT COUNT(*) as cnt FROM confessions WHERE text LIKE '%test@example.com%'").get();
  const phoneInDb = db.prepare("SELECT COUNT(*) as cnt FROM confessions WHERE text LIKE '%555-123-4567%'").get();
  const ipInDb = db.prepare("SELECT COUNT(*) as cnt FROM confessions WHERE text LIKE '%192.168.1.1%'").get();

  console.log('  Emails in DB:', emailInDb.cnt, '(should be 0)');
  console.log('  Phones in DB:', phoneInDb.cnt, '(should be 0)');
  console.log('  IPs in DB:', ipInDb.cnt, '(should be 0)');
  results.push({ test: 'DB no PII stored', pass: emailInDb.cnt === 0 && phoneInDb.cnt === 0 && ipInDb.cnt === 0 });

  db.close();

  // Summary
  console.log('\n=== SUMMARY ===');
  results.forEach(r => console.log('  ' + (r.pass ? 'PASS' : 'FAIL') + ': ' + r.test));
  const allPass = results.every(r => r.pass);
  console.log('\n  Overall: ' + (allPass ? 'ALL PASS' : 'SOME FAILED'));

  // Cleanup - delete test confessions
  console.log('\n=== Cleanup ===');
  const db2 = new Database('./confessional.db');
  markers.forEach(m => {
    const d = db2.prepare("DELETE FROM confessions WHERE text LIKE ?").run('%' + m + '%');
    console.log('  Cleaned marker ' + m + ':', d.changes, 'rows');
  });
  db2.close();
}

run().catch(console.error);
