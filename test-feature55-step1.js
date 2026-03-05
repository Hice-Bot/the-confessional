var http = require('http');
var crypto = require('crypto');

var BASE = 'http://localhost:3003';
var AGT_KEY = 'agt_test_key_001';
var ADM_KEY = 'adm_test_key_001';

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
  var agentId = crypto.randomUUID();

  // Step 1: Create a session
  var sessResp = await request('POST', '/confessional/sessions', { agent_id: agentId }, {
    Authorization: 'Bearer ' + ADM_KEY
  });
  console.log('1. Created session:', sessResp.status, JSON.stringify(sessResp.data));
  var sessionId = sessResp.data.session_id;

  if (sessResp.status !== 200 || !sessionId) {
    console.log('FAIL: Could not create session');
    process.exit(1);
  }

  // Step 2: Close the session
  var closeResp = await request('POST', '/confessional/sessions/' + sessionId + '/close', null, {
    Authorization: 'Bearer ' + ADM_KEY
  });
  console.log('2. Closed session:', closeResp.status, JSON.stringify(closeResp.data));

  if (closeResp.status !== 200 || closeResp.data.status !== 'closed') {
    console.log('FAIL: Could not close session');
    process.exit(1);
  }

  // Verify it's closed in DB before restart
  var Database = require('better-sqlite3');
  var db = new Database('./confessional.db', { readonly: true });
  var session = db.prepare("SELECT * FROM sessions WHERE id = ?").get(sessionId);
  console.log('3. Session in DB before restart:', JSON.stringify(session));
  db.close();

  if (session.status !== 'closed') {
    console.log('FAIL: Session not closed in DB');
    process.exit(1);
  }

  console.log('\n=== PRE-RESTART STATE ===');
  console.log('Session ID:', sessionId);
  console.log('Status: closed');
  console.log('\n=== SAVE FOR RESTART TEST ===');
  console.log('SESSION_ID=' + sessionId);
}

main().catch(function(e) { console.error(e); process.exit(1); });
