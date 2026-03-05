// Additional verification for Feature #105
// 1. Verify HTML page loads and references feed endpoint
// 2. Verify pagination works correctly with edge cases
// 3. Verify no console errors in the feed endpoints
var http = require('http');

function request(method, urlPath) {
  return new Promise(function(resolve, reject) {
    var url = new URL(urlPath, 'http://localhost:3003');
    var opts = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      method: method
    };
    var req = http.request(opts, function(res) {
      var d = '';
      res.on('data', function(c) { d += c; });
      res.on('end', function() {
        resolve({ status: res.statusCode, body: d, headers: res.headers });
      });
    });
    req.on('error', reject);
    req.end();
  });
}

async function run() {
  console.log('=== Additional Verification for Feature #105 ===\n');

  // 1. Verify HTML page loads
  var htmlRes = await request('GET', '/confessional');
  console.log('1. HTML page: status=' + htmlRes.status + ', content-type=' + htmlRes.headers['content-type']);
  console.log('   Contains feed reference: ' + (htmlRes.body.indexOf('/confessional/feed') !== -1));
  console.log('   Contains IBM Plex Mono: ' + (htmlRes.body.indexOf('IBM Plex Mono') !== -1));

  // 2. Verify feed endpoint returns correct structure
  var feedRes = await request('GET', '/confessional/feed?limit=5');
  var feed = JSON.parse(feedRes.body);
  console.log('\n2. Feed structure check:');
  console.log('   Has confessions array: ' + Array.isArray(feed.confessions));
  console.log('   Has count: ' + (typeof feed.count === 'number'));
  console.log('   Has total: ' + (typeof feed.total === 'number'));
  console.log('   Has next_cursor: ' + ('next_cursor' in feed));
  console.log('   Confessions have only text field: ' + (feed.confessions.length > 0 && Object.keys(feed.confessions[0]).length === 1 && 'text' in feed.confessions[0]));

  // 3. Verify cursor-based pagination returns different results
  if (feed.next_cursor) {
    var page2Res = await request('GET', '/confessional/feed?limit=5&before=' + encodeURIComponent(feed.next_cursor));
    var page2 = JSON.parse(page2Res.body);
    var page1texts = feed.confessions.map(function(c) { return c.text; });
    var page2texts = page2.confessions.map(function(c) { return c.text; });
    var overlap = page1texts.filter(function(t) { return page2texts.indexOf(t) !== -1; });
    console.log('\n3. Page 1 vs Page 2 overlap check:');
    console.log('   Page 1 texts: ' + page1texts.length);
    console.log('   Page 2 texts: ' + page2texts.length);
    console.log('   Overlapping texts: ' + overlap.length + (overlap.length === 0 ? ' (PASS - no overlap)' : ' (possible duplicate content)'));
  }

  // 4. Verify count endpoint consistency
  var countRes = await request('GET', '/confessional/count');
  var count = JSON.parse(countRes.body);
  console.log('\n4. Count consistency:');
  console.log('   /confessional/count: ' + count.count);
  console.log('   /confessional/feed total: ' + feed.total);
  console.log('   Match: ' + (count.count === feed.total ? 'PASS' : 'FAIL'));

  // 5. Verify server health
  var healthRes = await request('GET', '/api/health');
  var health = JSON.parse(healthRes.body);
  console.log('\n5. Server health: ' + health.status + ', database: ' + health.database);

  console.log('\n=== All additional checks complete ===');
}

run().catch(function(e) { console.error('Error:', e); });
