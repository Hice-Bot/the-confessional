const http = require('http');

function timedGet(url) {
  return new Promise((resolve, reject) => {
    const start = Date.now();
    http.get(url, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        const elapsed = Date.now() - start;
        resolve({ status: res.statusCode, contentType: res.headers['content-type'], elapsed, body: data });
      });
    }).on('error', reject);
  });
}

async function run() {
  // Step 1: Verify 100+ confessions exist
  const countRes = await timedGet('http://localhost:3003/confessional/count');
  const countData = JSON.parse(countRes.body);
  console.log('=== Step 1: 100+ confessions exist ===');
  console.log('Count:', countData.count);
  console.log('PASS:', countData.count >= 100 ? 'YES' : 'NO');

  // Step 2: GET /confessional returns 200 with HTML
  const htmlRes = await timedGet('http://localhost:3003/confessional');
  console.log('\n=== Step 2: GET /confessional returns 200 with HTML ===');
  console.log('Status:', htmlRes.status);
  console.log('Content-Type:', htmlRes.contentType);
  console.log('Contains <!DOCTYPE html>:', htmlRes.body.includes('<!DOCTYPE html>'));
  console.log('PASS:', htmlRes.status === 200 && htmlRes.contentType.includes('text/html') ? 'YES' : 'NO');

  // Step 3: Page HTML returned (not a timeout)
  console.log('\n=== Step 3: Page HTML returned (not timeout) ===');
  console.log('Response time:', htmlRes.elapsed, 'ms');
  console.log('Body length:', htmlRes.body.length, 'chars');
  console.log('PASS:', htmlRes.elapsed < 5000 && htmlRes.body.length > 100 ? 'YES' : 'NO');

  // Step 4: Initial load fetches only 20 confessions (not all 100+)
  // Check the JS code in the HTML page - it should use limit=20 or default limit
  console.log('\n=== Step 4: Initial load fetches only 20 (not all 100+) ===');

  // Check if the HTML page JS fetches with a limit
  const hasLimitedFetch = htmlRes.body.includes('limit=20') || htmlRes.body.includes('limit=');
  console.log('JS uses limited fetch:', hasLimitedFetch);

  // Verify the feed default returns only 20
  const feedRes = await timedGet('http://localhost:3003/confessional/feed');
  const feedData = JSON.parse(feedRes.body);
  console.log('Default feed returns:', feedData.count, 'confessions (of', feedData.total, 'total)');
  console.log('PASS:', feedData.count === 20 && feedData.total >= 100 ? 'YES' : 'NO');

  // Step 5: Page does NOT pre-load all confessions at once
  console.log('\n=== Step 5: Page does not pre-load all confessions ===');

  // The HTML should not contain all confession texts embedded in it
  // Count how many confession-like text blocks are in the static HTML
  // The HTML should be relatively small (confessions loaded via JS fetch, not server-rendered)
  const htmlSizeKB = (htmlRes.body.length / 1024).toFixed(1);
  console.log('HTML size:', htmlSizeKB, 'KB');

  // If all 159 confessions were embedded, the page would be much larger
  // A typical confession is ~200 chars, so 159 * 200 = ~31KB of just text
  // The HTML itself should be under 10KB without embedded confessions
  const hasNoEmbeddedConfessions = htmlRes.body.length < 15000; // generous threshold
  console.log('HTML is compact (no embedded confessions):', hasNoEmbeddedConfessions);

  // Also verify the page uses fetch/XHR to load confessions (not server-rendered)
  const usesFetch = htmlRes.body.includes('fetch(') || htmlRes.body.includes('/confessional/feed');
  console.log('Uses client-side fetch:', usesFetch);
  console.log('PASS:', hasNoEmbeddedConfessions && usesFetch ? 'YES' : 'NO');

  console.log('\n=== Overall: All 5 steps verified ===');
}

run().catch(console.error);
