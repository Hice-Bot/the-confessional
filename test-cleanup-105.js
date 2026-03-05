// Clean up ALL old F105 test data
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
  // Get all confessions from agent feed
  var res = await request('GET', '/confessional/feed/agent?limit=200', null,
    { 'Authorization': 'Bearer ' + AGT_KEY }
  );
  console.log('Total confessions: ' + res.body.confessions.length);

  var toDelete = res.body.confessions.filter(function(c) {
    return c.text && c.text.indexOf('_UNIQUE_F105') !== -1;
  });
  console.log('F105 test confessions to delete: ' + toDelete.length);

  for (var i = 0; i < toDelete.length; i++) {
    var delRes = await request('DELETE', '/confessional/admin/confessions/' + toDelete[i].id, null,
      { 'Authorization': 'Bearer ' + ADM_KEY }
    );
    if (delRes.status === 200) {
      console.log('  Deleted: ' + toDelete[i].text);
    }
  }

  // Verify
  var res2 = await request('GET', '/confessional/count');
  console.log('\nRemaining unflagged count: ' + res2.body.count);
}

run().catch(function(e) { console.error(e); });
