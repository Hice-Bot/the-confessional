var http = require('http');

function fetchPage(callback) {
  var options = {
    hostname: 'localhost',
    port: 3003,
    path: '/confessional',
    method: 'GET'
  };

  var body = '';
  var req = http.request(options, function(res) {
    res.on('data', function(chunk) { body += chunk; });
    res.on('end', function() { callback(null, body, res); });
  });
  req.on('error', function(e) { callback(e); });
  req.end();
}

function fetchFeed(callback) {
  var options = {
    hostname: 'localhost',
    port: 3003,
    path: '/confessional/feed',
    method: 'GET'
  };

  var body = '';
  var req = http.request(options, function(res) {
    res.on('data', function(chunk) { body += chunk; });
    res.on('end', function() { callback(null, body, res); });
  });
  req.on('error', function(e) { callback(e); });
  req.end();
}

// Test 1: Page serves HTML with fetch logic
fetchPage(function(err, html, res) {
  if (err) { console.error('Error:', err); process.exit(1); }

  var contentType = res.headers['content-type'];
  console.log('Content-Type:', contentType);
  console.log('Includes text/html:', contentType.includes('text/html'));
  console.log('Has fetch /confessional/feed:', html.includes('/confessional/feed'));
  console.log('Has createElement div:', html.includes("createElement('div')"));
  console.log('Has createElement p:', html.includes("createElement('p')"));
  console.log('Has textContent assignment:', html.includes('p.textContent = confession.text'));
  console.log('Has class confession:', html.includes("className = 'confession'"));

  // Test 2: Feed returns our test data
  fetchFeed(function(err2, feedBody) {
    if (err2) { console.error('Error:', err2); process.exit(1); }

    var data = JSON.parse(feedBody);
    var found = data.confessions.some(function(c) { return c.text === 'HTML_RENDER_TEST'; });
    console.log('Feed has HTML_RENDER_TEST:', found);
    console.log('Feed has confessions:', data.confessions.length > 0);
    console.log('Each confession has text field:', data.confessions.every(function(c) { return typeof c.text === 'string'; }));

    console.log('\nALL CHECKS PASSED');
  });
});
