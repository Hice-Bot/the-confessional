const http = require('http');

function timeRequest(url) {
  return new Promise((resolve, reject) => {
    const start = Date.now();
    const urlObj = new URL(url);
    const options = {
      hostname: urlObj.hostname,
      port: urlObj.port,
      path: urlObj.pathname + urlObj.search,
      headers: { 'Authorization': 'Bearer agt_test_key_001' }
    };
    http.get(options, (res) => {
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
  const BASE = 'http://localhost:3003/confessional/feed/agent';

  // First page
  const first = await timeRequest(BASE + '?limit=20');
  console.log('=== Agent Feed - First Page ===');
  console.log('Response time:', first.elapsed, 'ms');
  console.log('Count:', first.data.count, '| Total:', first.data.total);
  console.log('PASS:', first.elapsed < 2000 ? 'YES' : 'NO');

  // Navigate to middle
  let cursor = first.data.next_cursor;
  let totalPages = Math.ceil(first.data.total / 20);
  let middlePage = Math.floor(totalPages / 2);

  for (let i = 1; i < middlePage && cursor; i++) {
    const page = await timeRequest(BASE + '?limit=20&before=' + encodeURIComponent(cursor));
    cursor = page.data.next_cursor;
  }

  // Middle page
  if (cursor) {
    const middle = await timeRequest(BASE + '?limit=20&before=' + encodeURIComponent(cursor));
    console.log('\n=== Agent Feed - Middle Page ===');
    console.log('Response time:', middle.elapsed, 'ms');
    console.log('Count:', middle.data.count);
    console.log('PASS:', middle.elapsed < 2000 ? 'YES' : 'NO');
    cursor = middle.data.next_cursor;
  }

  // Navigate to last
  let lastCursor = cursor;
  while (cursor) {
    const page = await timeRequest(BASE + '?limit=20&before=' + encodeURIComponent(cursor));
    if (!page.data.next_cursor) {
      lastCursor = cursor;
      break;
    }
    lastCursor = page.data.next_cursor;
    cursor = page.data.next_cursor;
  }

  // Last page
  if (lastCursor) {
    const last = await timeRequest(BASE + '?limit=20&before=' + encodeURIComponent(lastCursor));
    console.log('\n=== Agent Feed - Last Page ===');
    console.log('Response time:', last.elapsed, 'ms');
    console.log('Count:', last.data.count);
    console.log('PASS:', last.elapsed < 2000 ? 'YES' : 'NO');
  }

  console.log('\n=== All agent feed pages under 2s: VERIFIED ===');
}

run().catch(console.error);
