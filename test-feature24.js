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

function alphaMarker(prefix) {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  const suffix = Array.from({length: 8}, () => chars[Math.floor(Math.random() * chars.length)]).join('');
  return prefix + suffix;
}

async function run() {
  const marker = alphaMarker('MULTIPII');
  console.log('Marker:', marker);

  // Create session
  const sessResp = await request('POST', '/confessional/sessions', { agent_id: uuid() }, {
    'Authorization': 'Bearer ' + ADM_KEY
  });
  console.log('Session created:', sessResp.status, sessResp.body.session_id);

  await new Promise(r => setTimeout(r, 500));

  // Submit confession with multiple PII types
  const originalText = 'Email me at a@b.com or call 555-000-1234 or visit 10.0.0.1 ' + marker;
  console.log('Original text:', originalText);

  const submitResp = await request('POST', '/confessional/submit', { text: originalText }, {
    'Authorization': 'Bearer ' + AGT_KEY,
    'X-Session-ID': sessResp.body.session_id
  });
  console.log('Submit:', submitResp.status, JSON.stringify(submitResp.body));

  await new Promise(r => setTimeout(r, 500));

  // Fetch from feed
  const feedResp = await request('GET', '/confessional/feed?limit=100', null);
  const confession = feedResp.body.confessions.find(c => c.text.includes(marker));

  if (!confession) {
    console.log('ERROR: Confession with marker not found!');
    return;
  }

  console.log('\nStored text:', confession.text);
  console.log('');

  // Check each PII type
  const hasEmail = confession.text.includes('a@b.com');
  const hasPhone = confession.text.includes('555-000-1234');
  const hasIP = confession.text.includes('10.0.0.1');
  const hasRedacted = confession.text.includes('[redacted]');

  // Count [redacted] occurrences
  const redactedCount = (confession.text.match(/\[redacted\]/g) || []).length;

  // Check surrounding text preserved
  const hasEmailMe = confession.text.includes('Email me at');
  const hasOrCall = confession.text.includes('or call');
  const hasOrVisit = confession.text.includes('or visit');
  const hasMarker = confession.text.includes(marker);

  console.log('Step 3 - Email a@b.com removed:', !hasEmail, '(should be true)');
  console.log('Step 4 - Phone 555-000-1234 removed:', !hasPhone, '(should be true)');
  console.log('Step 5 - IP 10.0.0.1 removed:', !hasIP, '(should be true)');
  console.log('Step 6 - [redacted] count:', redactedCount, '(should be >= 3)');
  console.log('Step 6 - Surrounding text "Email me at":', hasEmailMe, '(should be true)');
  console.log('Step 6 - Surrounding text "or call":', hasOrCall, '(should be true)');
  console.log('Step 6 - Surrounding text "or visit":', hasOrVisit, '(should be true)');
  console.log('Step 6 - Marker preserved:', hasMarker, '(should be true)');

  const allPass = !hasEmail && !hasPhone && !hasIP && hasRedacted && redactedCount >= 3 &&
                  hasEmailMe && hasOrCall && hasOrVisit && hasMarker;

  console.log('\nOverall:', allPass ? 'ALL PASS' : 'SOME FAILED');

  // Cleanup
  const Database = require('better-sqlite3');
  const db = new Database('./confessional.db');
  const d = db.prepare("DELETE FROM confessions WHERE text LIKE ?").run('%' + marker + '%');
  console.log('\nCleanup:', d.changes, 'rows deleted');
  db.close();
}

run().catch(console.error);
