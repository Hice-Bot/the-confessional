const http = require('http');

const AGT_KEY = 'agt_test_key_001';
const ADM_KEY = 'adm_test_key_001';
const BASE = 'http://localhost:3003';

function request(method, path, headers, body) {
  return new Promise((resolve, reject) => {
    var url = new URL(path, BASE);
    var opts = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      method: method,
      headers: headers || {}
    };
    var req = http.request(opts, (res) => {
      var data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        resolve({ status: res.statusCode, headers: res.headers, body: data });
      });
    });
    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

async function run() {
  console.log('=== Feature #46: Human feed pagination works with HTML page ===\n');

  // Step 1: Verify we have at least 25 confessions
  console.log('Step 1: Check we have at least 25 confessions...');
  var countRes = await request('GET', '/confessional/count', {});
  var countData = JSON.parse(countRes.body);
  console.log('  Current confession count:', countData.count);
  console.log('  Have 25+ confessions:', countData.count >= 25);

  // Step 2: Load /confessional HTML page
  console.log('\nStep 2: Load /confessional HTML page...');
  var htmlRes = await request('GET', '/confessional', {});
  console.log('  Status:', htmlRes.status);
  console.log('  Content-Type:', htmlRes.headers['content-type']);
  var isHtml = htmlRes.body.indexOf('<!DOCTYPE html>') !== -1;
  console.log('  Is HTML page:', isHtml);

  // Step 3: Verify initial load shows confessions (default limit 20)
  console.log('\nStep 3: Verify initial feed load returns default 20...');
  var feedRes = await request('GET', '/confessional/feed?limit=20', {});
  var feedData = JSON.parse(feedRes.body);
  console.log('  Feed status:', feedRes.status);
  console.log('  Confessions returned:', feedData.count);
  console.log('  Total unflagged:', feedData.total);
  console.log('  Returns 20 (default limit):', feedData.count === 20);
  console.log('  Has next_cursor:', feedData.next_cursor !== null);

  // Verify HTML JS fetches /confessional/feed?limit=20
  var htmlBody = htmlRes.body;
  var fetchesCorrectUrl = htmlBody.indexOf("/confessional/feed?limit=20") !== -1;
  console.log('  HTML JS fetches /confessional/feed?limit=20:', fetchesCorrectUrl);

  // Step 4: Verify the page JavaScript uses IntersectionObserver
  console.log('\nStep 4: Verify IntersectionObserver for infinite scroll...');
  var hasIntersectionObserver = htmlBody.indexOf('IntersectionObserver') !== -1;
  var hasSentinel = htmlBody.indexOf('sentinel') !== -1;
  var observesSentinel = htmlBody.indexOf('observer.observe(sentinel)') !== -1;
  console.log('  Uses IntersectionObserver:', hasIntersectionObserver);
  console.log('  Has sentinel element:', hasSentinel);
  console.log('  Observes sentinel:', observesSentinel);

  // Step 5: Verify scroll/load-more fetches next page using next_cursor
  console.log('\nStep 5: Verify pagination uses next_cursor...');
  var usesNextCursor = htmlBody.indexOf('nextCursor') !== -1;
  var usesBeforeParam = htmlBody.indexOf('before=') !== -1;
  var encodesUri = htmlBody.indexOf('encodeURIComponent(nextCursor)') !== -1;
  console.log('  JS tracks nextCursor variable:', usesNextCursor);
  console.log('  JS uses ?before= parameter:', usesBeforeParam);
  console.log('  JS encodeURIComponent on cursor:', encodesUri);

  // Simulate the pagination: fetch page 1, then page 2 using cursor
  var page1Cursor = feedData.next_cursor;
  console.log('  Page 1 cursor:', page1Cursor ? page1Cursor.substring(0, 40) + '...' : null);

  var page2Res = await request('GET', '/confessional/feed?limit=20&before=' + encodeURIComponent(page1Cursor), {});
  var page2Data = JSON.parse(page2Res.body);
  console.log('  Page 2 status:', page2Res.status);
  console.log('  Page 2 confessions:', page2Data.count);
  console.log('  Page 2 has next_cursor:', page2Data.next_cursor !== null);

  // Step 6: Verify older confessions appear after pagination
  console.log('\nStep 6: Verify older confessions appear after pagination...');
  // Page 1 texts
  var page1Texts = feedData.confessions.map(function(c) { return c.text; });
  var page2Texts = page2Data.confessions.map(function(c) { return c.text; });

  // Verify no overlap
  var overlap = false;
  for (var i = 0; i < page2Texts.length; i++) {
    if (page1Texts.indexOf(page2Texts[i]) !== -1) {
      overlap = true;
      break;
    }
  }
  console.log('  No overlap between page 1 and page 2:', !overlap);
  console.log('  Page 2 has different (older) confessions:', page2Data.count > 0);

  // Verify the HTML properly stores cursor and updates it
  var storesCursor = htmlBody.indexOf('nextCursor = data.next_cursor') !== -1;
  var checksHasMore = htmlBody.indexOf('hasMore') !== -1;
  console.log('  JS updates nextCursor from response:', storesCursor);
  console.log('  JS tracks hasMore for stopping:', checksHasMore);

  // Also verify CSS and structure match spec
  console.log('\n  Additional checks:');
  var hasLoadingClass = htmlBody.indexOf('loading') !== -1;
  var hasEmptyState = htmlBody.indexOf('confessional is empty') !== -1 || htmlBody.indexOf('showEmptyState') !== -1;
  var hasFadeIn = htmlBody.indexOf('fadeIn') !== -1;
  var hasStaggeredDelay = htmlBody.indexOf('animationDelay') !== -1;
  var noAnimOnScrolled = htmlBody.indexOf("animation = 'none'") !== -1 || htmlBody.indexOf('animation: \'none\'') !== -1;
  console.log('  Has loading state:', hasLoadingClass);
  console.log('  Has empty state handler:', hasEmptyState);
  console.log('  Has fadeIn animation:', hasFadeIn);
  console.log('  Has staggered delay for first load:', hasStaggeredDelay);
  console.log('  No animation on scroll-loaded:', noAnimOnScrolled);

  // Summary
  console.log('\n=== RESULTS ===');
  var allPassed = countData.count >= 25
    && isHtml
    && feedData.count === 20
    && feedData.next_cursor !== null
    && fetchesCorrectUrl
    && hasIntersectionObserver && hasSentinel && observesSentinel
    && usesNextCursor && usesBeforeParam && encodesUri
    && !overlap && page2Data.count > 0
    && storesCursor && checksHasMore;
  console.log('All checks passed:', allPassed);
}

run().catch(console.error);
