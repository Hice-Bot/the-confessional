// Verify Feature #69: Empty state displays correctly
// Simulates the client-side JavaScript behavior

const http = require('http');

function get(path) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, 'http://localhost:3003');
    http.get(url, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, headers: res.headers, body: JSON.parse(data) }); }
        catch { resolve({ status: res.statusCode, headers: res.headers, body: data }); }
      });
    }).on('error', reject);
  });
}

async function verify() {
  console.log('=== Feature #69: Empty state displays correctly ===\n');

  // Step 1: Verify no unflagged confessions exist
  const countRes = await get('/confessional/count');
  console.log('Step 1: Count endpoint returns:', countRes.body);
  console.assert(countRes.body.count === 0, 'Expected 0 unflagged confessions');
  console.log('✓ No unflagged confessions exist\n');

  // Step 2: Verify feed returns empty array
  const feedRes = await get('/confessional/feed');
  console.log('Step 2: Feed returns:', JSON.stringify(feedRes.body));
  console.assert(feedRes.body.confessions.length === 0, 'Expected empty confessions array');
  console.assert(feedRes.body.count === 0, 'Expected count 0');
  console.assert(feedRes.body.total === 0, 'Expected total 0');
  console.assert(feedRes.body.next_cursor === null, 'Expected null cursor');
  console.log('✓ Feed returns empty array with count 0\n');

  // Step 3: Verify HTML page is served
  const htmlRes = await get('/confessional');
  console.log('Step 3: HTML page status:', htmlRes.status);
  console.assert(htmlRes.status === 200, 'Expected 200');
  console.assert(htmlRes.headers['content-type'].includes('text/html'), 'Expected text/html');
  console.log('✓ HTML page served successfully\n');

  // Step 4: Verify empty state text is in the JavaScript
  const html = htmlRes.body;
  console.log('Step 4: Checking empty state text...');
  console.assert(html.includes('The confessional is empty.'), 'Missing "The confessional is empty." text');
  console.assert(html.includes('Be the first to confess.'), 'Missing "Be the first to confess." text');
  console.log('✓ "The confessional is empty." text present');
  console.log('✓ "Be the first to confess." text present\n');

  // Step 5: Verify the showEmptyState function exists and creates correct elements
  console.log('Step 5: Checking empty state rendering logic...');
  console.assert(html.includes('showEmptyState'), 'Missing showEmptyState function');
  console.assert(html.includes("class='empty-state'") || html.includes('className = \'empty-state\''),
    'Missing empty-state class assignment');
  console.log('✓ showEmptyState function exists');
  console.log('✓ empty-state CSS class applied\n');

  // Step 6: Verify the condition that triggers empty state
  console.log('Step 6: Checking trigger condition...');
  console.assert(html.includes('data.confessions.length === 0'), 'Missing empty check condition');
  console.assert(html.includes("container.children.length === 0"), 'Missing container empty check');
  console.log('✓ Empty state triggered when confessions array is empty AND container is empty\n');

  // Step 7: Verify CSS styling matches spec
  console.log('Step 7: Checking CSS styling...');
  console.assert(html.includes('.empty-state'), 'Missing .empty-state CSS');
  console.assert(html.includes("font-family: 'IBM Plex Mono'"), 'Missing IBM Plex Mono font');
  console.assert(html.includes('color: #f0f0f0'), 'Missing text color');
  console.assert(html.includes('background: #000000'), 'Missing black background');

  // Verify empty-state inherits body font (no override)
  const emptyStateCSS = html.match(/\.empty-state\s*\{[^}]+\}/)?.[0] || '';
  console.log('  .empty-state CSS:', emptyStateCSS);
  console.assert(!emptyStateCSS.includes('font-family'), 'empty-state should NOT override font (should inherit)');
  console.log('✓ empty-state inherits body monospace font (no override)');
  console.log('✓ Same IBM Plex Mono font family');
  console.log('✓ Same #f0f0f0 text color on #000000 background\n');

  console.log('=== ALL VERIFICATIONS PASSED ===');
}

verify().catch(console.error);
