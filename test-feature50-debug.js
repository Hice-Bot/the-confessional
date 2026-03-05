var http = require('http');

var BASE = 'http://localhost:3003';
var AGT_KEY = 'agt_test_key_001';

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
      var data = '';
      res.on('data', function(c) { data += c; });
      res.on('end', function() {
        try { resolve({ status: res.statusCode, body: JSON.parse(data) }); }
        catch(e) { resolve({ status: res.statusCode, body: data }); }
      });
    });
    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

async function run() {
  // Get the latest confessions from agent feed to see what text looks like after PII scrubbing
  var res = await request('GET', '/confessional/feed/agent?limit=5', null, {
    'Authorization': 'Bearer ' + AGT_KEY
  });
  console.log('Latest 5 confessions in agent feed:');
  for (var i = 0; i < res.body.confessions.length; i++) {
    var c = res.body.confessions[i];
    console.log('  [' + i + '] text: "' + c.text + '" | created_at: ' + c.created_at);
  }

  // Also check DB directly for F50 entries
  var Database = require('better-sqlite3');
  var db = new Database('./confessional.db', { readonly: true });
  var rows = db.prepare("SELECT id, text, created_at FROM confessions ORDER BY created_at DESC LIMIT 5").all();
  console.log('\nLatest 5 in DB:');
  for (var j = 0; j < rows.length; j++) {
    console.log('  [' + j + '] text: "' + rows[j].text + '" | created_at: ' + rows[j].created_at);
  }
  db.close();
}

run().catch(function(err) { console.error(err); process.exit(1); });
