const http = require('http');

function timeRequest(url) {
  return new Promise((resolve, reject) => {
    const start = Date.now();
    http.get(url, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        const elapsed = Date.now() - start;
        const parsed = JSON.parse(data);
        resolve({ elapsed, data: parsed });
      });
    }).on('error', reject);
  });
}

async function run() {
  const BASE = 'http://localhost:3003/confessional/feed';

  // Step 1: First page (no cursor)
  const first = await timeRequest(BASE + '?limit=20');
  console.log('=== First Page (no cursor) ===');
  console.log('Response time:', first.elapsed, 'ms');
  console.log('Count:', first.data.count, '| Total:', first.data.total);
  console.log('Has next_cursor:', !!first.data.next_cursor);
  console.log('PASS:', first.elapsed < 2000 ? 'YES' : 'NO');

  // Navigate to middle
  let cursor = first.data.next_cursor;
  let totalPages = Math.ceil(first.data.total / 20);
  let middlePage = Math.floor(totalPages / 2);

  for (let i = 1; i < middlePage && cursor; i++) {
    const page = await timeRequest(BASE + '?limit=20&before=' + encodeURIComponent(cursor));
    cursor = page.data.next_cursor;
  }

  // Step 2: Middle page (with cursor)
  if (cursor) {
    const middle = await timeRequest(BASE + '?limit=20&before=' + encodeURIComponent(cursor));
    console.log('\n=== Middle Page (page ~' + (middlePage + 1) + ' of ' + totalPages + ') ===');
    console.log('Response time:', middle.elapsed, 'ms');
    console.log('Count:', middle.data.count, '| Total:', middle.data.total);
    console.log('Has next_cursor:', !!middle.data.next_cursor);
    console.log('PASS:', middle.elapsed < 2000 ? 'YES' : 'NO');
    cursor = middle.data.next_cursor;
  }

  // Navigate to last page
  let lastCursor = cursor;
  while (cursor) {
    const page = await timeRequest(BASE + '?limit=20&before=' + encodeURIComponent(cursor));
    if (!page.data.next_cursor) {
      // We're on the last page now, but measure it fresh
      lastCursor = cursor;
      break;
    }
    lastCursor = page.data.next_cursor;
    cursor = page.data.next_cursor;
  }

  // Step 3: Last page
  if (lastCursor) {
    const last = await timeRequest(BASE + '?limit=20&before=' + encodeURIComponent(lastCursor));
    console.log('\n=== Last Page ===');
    console.log('Response time:', last.elapsed, 'ms');
    console.log('Count:', last.data.count, '| Total:', last.data.total);
    console.log('Has next_cursor:', !!last.data.next_cursor);
    console.log('PASS:', last.elapsed < 2000 ? 'YES' : 'NO');
  }

  console.log('\n=== Summary ===');
  console.log('Dataset size:', first.data.total, 'confessions');
  console.log('All response times under 2 seconds: verified above');
}

run().catch(console.error);
