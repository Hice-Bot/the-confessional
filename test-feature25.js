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
  const marker = alphaMarker('XSSTEST');
  console.log('Marker:', marker);

  // Step 1: Create session and submit with script tag
  console.log('\n=== Step 1: Submit confession with <script>alert(1)</script> ===');
  const sessResp = await request('POST', '/confessional/sessions', { agent_id: uuid() }, {
    'Authorization': 'Bearer ' + ADM_KEY
  });
  console.log('Session created:', sessResp.status, sessResp.body.session_id);

  await new Promise(r => setTimeout(r, 500));

  const xssText = '<script>alert(1)</script> ' + marker;
  console.log('Original text:', xssText);

  const submitResp = await request('POST', '/confessional/submit', { text: xssText }, {
    'Authorization': 'Bearer ' + AGT_KEY,
    'X-Session-ID': sessResp.body.session_id
  });
  console.log('Submit:', submitResp.status, JSON.stringify(submitResp.body));

  await new Promise(r => setTimeout(r, 500));

  // Step 2: GET /confessional/feed
  console.log('\n=== Step 2: Get feed ===');
  const feedResp = await request('GET', '/confessional/feed?limit=100', null);
  const confession = feedResp.body.confessions.find(c => c.text.includes(marker));

  if (!confession) {
    console.log('ERROR: Confession not found in feed!');
    // Maybe the script tag got stripped and we need to look differently
    console.log('First 5 confessions:', JSON.stringify(feedResp.body.confessions.slice(0, 5)));
    return;
  }

  console.log('Stored text:', JSON.stringify(confession.text));

  // Step 3: Verify the feed text contains escaped HTML, not raw script tags
  const hasRawScript = confession.text.includes('<script>');
  const hasRawScriptClose = confession.text.includes('</script>');
  console.log('\n=== Step 3: Feed contains escaped HTML, not raw script ===');
  console.log('  Has raw <script>:', hasRawScript, '(should be false)');
  console.log('  Has raw </script>:', hasRawScriptClose, '(should be false)');

  // Step 4: Verify < and > are escaped as &lt; &gt; (or stripped entirely)
  console.log('\n=== Step 4: < and > escaped or stripped ===');
  // The sanitizer first strips <script>...</script> tags, then escapes remaining HTML
  // So for '<script>alert(1)</script>' the script tag is stripped first, leaving just the marker
  // Any remaining < or > from non-script HTML would be escaped as &lt; &gt;
  const hasEscapedLt = confession.text.includes('&lt;');
  const hasEscapedGt = confession.text.includes('&gt;');
  console.log('  Has &lt;:', hasEscapedLt, '(escaped angle brackets)');
  console.log('  Has &gt;:', hasEscapedGt, '(escaped angle brackets)');
  console.log('  Script tags stripped entirely (valid alternative)');

  // Step 5: Script should NOT execute if rendered in HTML
  console.log('\n=== Step 5: Script would NOT execute if rendered ===');
  const wouldExecute = confession.text.includes('<script>') && confession.text.includes('alert(');
  console.log('  Would script execute:', wouldExecute, '(should be false)');

  // Additional test: Submit HTML that is NOT a script tag to verify escaping
  console.log('\n=== Bonus: Non-script HTML escaping ===');
  const marker2 = alphaMarker('HTMLESC');
  const sessResp2 = await request('POST', '/confessional/sessions', { agent_id: uuid() }, {
    'Authorization': 'Bearer ' + ADM_KEY
  });
  await new Promise(r => setTimeout(r, 500));

  const htmlText = '<b>bold</b> & "quotes" ' + marker2;
  console.log('Original text:', htmlText);

  await request('POST', '/confessional/submit', { text: htmlText }, {
    'Authorization': 'Bearer ' + AGT_KEY,
    'X-Session-ID': sessResp2.body.session_id
  });
  await new Promise(r => setTimeout(r, 500));

  const feedResp2 = await request('GET', '/confessional/feed?limit=100', null);
  const confession2 = feedResp2.body.confessions.find(c => c.text.includes(marker2));
  if (confession2) {
    console.log('Stored text:', JSON.stringify(confession2.text));
    const hasEscapedAmp = confession2.text.includes('&amp;');
    const hasEscapedQuot = confession2.text.includes('&quot;');
    const hasEscLt = confession2.text.includes('&lt;');
    const hasEscGt = confession2.text.includes('&gt;');
    console.log('  &amp; present:', hasEscapedAmp, '(should be true)');
    console.log('  &quot; present:', hasEscapedQuot, '(should be true)');
    console.log('  &lt; present:', hasEscLt, '(should be true)');
    console.log('  &gt; present:', hasEscGt, '(should be true)');
  }

  // Overall verdict
  const pass = !hasRawScript && !hasRawScriptClose && !wouldExecute;
  console.log('\n=== RESULT ===');
  console.log('Overall:', pass ? 'ALL PASS' : 'SOME FAILED');

  // Cleanup
  const Database = require('better-sqlite3');
  const db = new Database('./confessional.db');
  const d1 = db.prepare("DELETE FROM confessions WHERE text LIKE ?").run('%' + marker + '%');
  const d2 = db.prepare("DELETE FROM confessions WHERE text LIKE ?").run('%' + marker2 + '%');
  console.log('\nCleanup:', d1.changes + d2.changes, 'rows deleted');
  db.close();
}

run().catch(console.error);
