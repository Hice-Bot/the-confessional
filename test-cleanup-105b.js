// Clean up ALL F105 test data via agent feed pagination
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
  // Paginate through agent feed to find ALL F105 data
  var cursor = null;
  var toDelete = [];
  var page = 0;
  while (true) {
    page++;
    var path = '/confessional/feed/agent?limit=100';
    if (cursor) path += '&before=' + encodeURIComponent(cursor);
    var res = await request('GET', path, null, { 'Authorization': 'Bearer ' + AGT_KEY });
    if (res.status !== 200) break;

    for (var i = 0; i < res.body.confessions.length; i++) {
      var c = res.body.confessions[i];
      if (c.text && c.text.indexOf('_UNIQUE_F105') !== -1) {
        toDelete.push(c);
      }
    }

    if (!res.body.next_cursor) break;
    cursor = res.body.next_cursor;
    if (page > 10) break;
  }

  console.log('Found ' + toDelete.length + ' F105 confessions across ' + page + ' pages');

  for (var j = 0; j < toDelete.length; j++) {
    var delRes = await request('DELETE', '/confessional/admin/confessions/' + toDelete[j].id, null,
      { 'Authorization': 'Bearer ' + ADM_KEY }
    );
    if (delRes.status === 200) {
      process.stdout.write('.');
    }
  }
  console.log('\nDeleted ' + toDelete.length + ' confessions');

  var countRes = await request('GET', '/confessional/count');
  console.log('Remaining unflagged count: ' + countRes.body.count);
}

run().catch(function(e) { console.error(e); });
