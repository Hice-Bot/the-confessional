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

fetchPage(function(err, html) {
  if (err) { console.error('Error:', err); process.exit(1); }

  var allPassed = true;
  function check(name, result) {
    console.log((result ? 'PASS' : 'FAIL') + ': ' + name);
    if (!result) allPassed = false;
  }

  // Step 1: Page loads (200 OK with HTML)
  check('Page loads as HTML', html.includes('<!DOCTYPE html>'));

  // Step 2: Background is #000000
  check('Background is #000000', html.includes('background: #000000') || html.includes('background-color: #000000'));

  // Step 3: Text color is #f0f0f0
  check('Text color is #f0f0f0', html.includes('color: #f0f0f0'));

  // Step 4: Font is IBM Plex Mono or monospace fallback
  check('Font is IBM Plex Mono', html.includes("'IBM Plex Mono'"));
  check('Has monospace fallback', html.includes('monospace'));
  check('Google Fonts CDN link', html.includes('fonts.googleapis.com') && html.includes('IBM+Plex+Mono'));

  // Step 5: Confessions displayed as plain paragraphs
  check('Creates p elements', html.includes("createElement('p')"));
  check('Sets textContent on p', html.includes('p.textContent'));

  // Step 6: Single column layout centered on page
  check('Body uses flex centering', html.includes('justify-content: center'));
  check('Container has width: 100%', html.includes('width: 100%'));

  // Step 7: ~65 character max line width
  check('Max width is 65ch', html.includes('max-width: 65ch'));

  // Step 8: Generous margins/padding on sides
  check('Body has padding', html.includes('padding: 3em 1.5em'));

  // Step 9: No header, footer, sidebar, or navigation chrome
  check('No <header> element', !html.includes('<header'));
  check('No <footer> element', !html.includes('<footer'));
  check('No <nav> element', !html.includes('<nav'));
  check('No <aside> (sidebar) element', !html.includes('<aside'));
  // Check no visible text like "Navigation", "Menu", etc.
  check('No navigation links', !html.includes('<a '));

  console.log('\n' + (allPassed ? 'ALL CHECKS PASSED' : 'SOME CHECKS FAILED'));
  process.exit(allPassed ? 0 : 1);
});
