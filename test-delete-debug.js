var http = require('http');
var AGT_KEY = 'agt_test_key_001';
var ADM_KEY = 'adm_test_key_001';

function request(method, path, body, headers) {
  headers = headers || {};
  return new Promise(function(resolve, reject) {
    var url = new URL(path, 'http://localhost:3003');
    var opts = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      method: method,
      headers: Object.assign({}, headers)
    };
    if (body) {
      var data = JSON.stringify(body);
      opts.headers['Content-Type'] = 'application/json';
      opts.headers['Content-Length'] = Buffer.byteLength(data);
    }
    var req = http.request(opts, function(res) {
      var d = '';
      res.on('data', function(c) { d += c; });
      res.on('end', function() {
        var parsed;
        try { parsed = JSON.parse(d); } catch(e) { parsed = d; }
        resolve({ status: res.statusCode, body: parsed });
      });
    });
    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

async function run() {
  // Get first F105 confession
  var res = await request('GET', '/confessional/feed/agent?limit=5', null,
    { 'Authorization': 'Bearer ' + AGT_KEY }
  );
  var target = null;
  for (var i = 0; i < res.body.confessions.length; i++) {
    if (res.body.confessions[i].text && res.body.confessions[i].text.indexOf('_UNIQUE_F105') !== -1) {
      target = res.body.confessions[i];
      break;
    }
  }

  if (!target) {
    console.log('No F105 confessions found');
    return;
  }

  console.log('Found: id=' + target.id + ' text=' + target.text);

  // Try to delete it
  var delRes = await request('DELETE', '/confessional/admin/confessions/' + target.id, null,
    { 'Authorization': 'Bearer ' + ADM_KEY }
  );
  console.log('Delete result: status=' + delRes.status + ' body=' + JSON.stringify(delRes.body));

  // Check if it's still there
  var check = await request('GET', '/confessional/feed/agent?limit=5', null,
    { 'Authorization': 'Bearer ' + AGT_KEY }
  );
  var stillThere = false;
  for (var j = 0; j < check.body.confessions.length; j++) {
    if (check.body.confessions[j].id === target.id) {
      stillThere = true;
      break;
    }
  }
  console.log('Still in feed after delete: ' + stillThere);
}

run().catch(function(e) { console.error(e); });
