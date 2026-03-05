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
  var uniqueMarker = 'ADMACT-PERSIST-WALRUS-FALCON-' + crypto.randomBytes(4).toString('hex').toUpperCase();
  var uniqueNote = 'NOTE-PERSIST-' + crypto.randomBytes(4).toString('hex').toUpperCase();
  var uniqueConfText = 'CONFESSION-FOR-FLAGGING-' + uniqueMarker;

  console.log('Unique marker:', uniqueMarker);
  console.log('Unique note:', uniqueNote);

  // Step 1: Create session
  var sessResp = await request('POST', '/confessional/sessions', { agent_id: agentId }, {
    Authorization: 'Bearer ' + ADM_KEY
  });
  console.log('1. Created session:', sessResp.status, sessResp.data);
  var sessionId = sessResp.data.session_id;

  // Step 2: Submit confession
  var submitResp = await request('POST', '/confessional/submit', { text: uniqueConfText }, {
    Authorization: 'Bearer ' + AGT_KEY,
    'X-Session-ID': sessionId
  });
  console.log('2. Submitted confession:', submitResp.status, submitResp.data);

  // Step 3: Find the confession ID via direct DB query
  var Database = require('better-sqlite3');
  var db = new Database('./confessional.db', { readonly: true });
  var confession = db.prepare("SELECT id, text FROM confessions WHERE text LIKE '%' || ? || '%' ORDER BY created_at DESC LIMIT 1").get(uniqueMarker);
  console.log('3. Found confession in DB:', confession ? confession.id : 'NOT FOUND');
  console.log('   Text:', confession ? confession.text : 'N/A');
  db.close();

  if (!confession) {
    console.log('ERROR: Confession not found in database');
    process.exit(1);
  }

  // Step 4: Flag the confession with a unique note
  var flagResp = await request('POST', '/confessional/admin/flag', {
    id: confession.id,
    note: uniqueNote
  }, {
    Authorization: 'Bearer ' + ADM_KEY
  });
  console.log('4. Flagged confession:', flagResp.status, flagResp.data);

  // Step 5: Verify admin_actions has the entry before restart
  var db2 = new Database('./confessional.db', { readonly: true });
  var action = db2.prepare("SELECT * FROM admin_actions WHERE note = ?").get(uniqueNote);
  console.log('5. Admin action in DB before restart:', JSON.stringify(action));
  db2.close();

  if (!action) {
    console.log('ERROR: Admin action not found before restart');
    process.exit(1);
  }

  console.log('\n=== PRE-RESTART STATE ===');
  console.log('Action ID:', action.id);
  console.log('Action type:', action.action);
  console.log('Confession ID:', action.confession_id);
  console.log('Admin key prefix:', action.admin_key_prefix);
  console.log('Note:', action.note);
  console.log('Created at:', action.created_at);

  // Output info for the restart test
  console.log('\n=== SAVE FOR RESTART TEST ===');
  console.log('ACTION_ID=' + action.id);
  console.log('UNIQUE_NOTE=' + uniqueNote);
  console.log('ADMIN_KEY_PREFIX=' + action.admin_key_prefix);
  console.log('CONFESSION_ID=' + confession.id);
}

main().catch(function(e) { console.error(e); process.exit(1); });
