var http = require('http');

var BASE = 'http://localhost:3003';
var AGT_KEY = 'agt_test_key_001';
var ADM_KEY = 'adm_test_key_001';
var SESSION_ID = '88cb7619-818d-4d86-b377-2cfab6004be0';

function request(method, path, body, headers) {
  headers = headers || {};
  return new Promise(function(resolve, reject) {
    var url = new URL(path, BASE);
    var opts = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      method: method,
      headers: Object.assign({ 'Content-Type': 'application/json' }, headers)
    };
    var req = http.request(opts, function(res) {
      var chunks = [];
      res.on('data', function(c) { chunks.push(c); });
      res.on('end', function() {
        var text = Buffer.concat(chunks).toString();
        try { resolve({ status: res.statusCode, data: JSON.parse(text) }); }
        catch(e) { resolve({ status: res.statusCode, data: text }); }
      });
    });
    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

async function main() {
  console.log('=== POST-RESTART VERIFICATION ===');
  console.log('Session ID:', SESSION_ID);

  // Step 4: Try to submit using the closed session → expect 403
  var submitResp = await request('POST', '/confessional/submit', { text: 'This should be rejected' }, {
    Authorization: 'Bearer ' + AGT_KEY,
    'X-Session-ID': SESSION_ID
  });
  console.log('\n1. Submit to closed session after restart:');
  console.log('   Status:', submitResp.status);
  console.log('   Response:', JSON.stringify(submitResp.data));

  if (submitResp.status === 403) {
    console.log('   PASS: Got 403 as expected');
  } else {
    console.log('   FAIL: Expected 403, got', submitResp.status);
    process.exit(1);
  }

  // Step 5: Verify session status is still 'closed' in database
  var Database = require('better-sqlite3');
  var db = new Database('./confessional.db', { readonly: true });
  var session = db.prepare("SELECT * FROM sessions WHERE id = ?").get(SESSION_ID);
  console.log('\n2. Session in DB after restart:', JSON.stringify(session));

  if (session && session.status === 'closed') {
    console.log('   PASS: Session status is still "closed"');
  } else {
    console.log('   FAIL: Session status is not "closed"');
    process.exit(1);
  }

  db.close();

  console.log('\n=== ALL CHECKS PASSED ===');
  console.log('Session state persists across server restart!');
}

main().catch(function(e) { console.error(e); process.exit(1); });
