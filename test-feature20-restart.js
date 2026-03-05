const http = require('http');

const BASE = 'http://localhost:3003';
const AGT_KEY = 'agt_test_key_001';

function request(method, path, body, headers = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE);
    const opts = {
      method,
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      headers: { ...headers }
    };
    if (body) {
      const data = JSON.stringify(body);
      opts.headers['Content-Type'] = 'application/json';
      opts.headers['Content-Length'] = Buffer.byteLength(data);
    }
    const req = http.request(opts, (res) => {
      let chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => {
        const text = Buffer.concat(chunks).toString();
        let json;
        try { json = JSON.parse(text); } catch(e) { json = null; }
        resolve({ status: res.statusCode, body: json, text });
      });
    });
    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

async function main() {
  const UNIQUE_TEXT = 'PERSIST_TEST_789_FEAT20_XYQWZ';

  console.log('=== Server Restart Persistence Test for Feature #20 ===\n');
  console.log('Checking if PERSIST_TEST_789_FEAT20_XYQWZ still exists after restart...');

  const feed = await request('GET', '/confessional/feed?limit=100', null);
  console.log('Feed status:', feed.status, '- count:', feed.body.count);
  const found = feed.body.confessions.some(c => c.text === UNIQUE_TEXT);
  console.log('Confession found:', found);

  if (found) {
    console.log('PASS: Data persists after server restart');
  } else {
    console.log('FAIL: Data lost after server restart - possible in-memory storage');
    process.exit(1);
  }
}

main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
