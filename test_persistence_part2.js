const http = require('http');

const BASE = 'http://localhost:3003';

function request(method, path, body, headers) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE);
    const opts = {
      method,
      hostname: url.hostname,
      port: url.port,
      path: url.pathname,
      headers: { ...headers, 'Content-Type': 'application/json' }
    };
    const req = http.request(opts, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, body: JSON.parse(data) });
        } catch (e) {
          resolve({ status: res.statusCode, body: data });
        }
      });
    });
    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

async function main() {
  const uniqueMarker = 'PERSIST-REGTEST-WALRUS-FALCON-ORCHID-VELVET-ZEPHYR';

  console.log('=== Post-restart: Verify confession persists ===');
  const feedRes = await request('GET', '/confessional/feed?limit=50', null, {});
  console.log('Feed response status:', feedRes.status);
  const confessions = feedRes.body.confessions || feedRes.body;
  const found = Array.isArray(confessions) && confessions.some(c => c.text.includes(uniqueMarker));
  console.log('Confession found in feed after restart:', found);

  if (found) {
    console.log('\n=== SUCCESS: Data persists across server restart ===');
  } else {
    console.log('\n=== FAILURE: Confession not found after restart ===');
    console.log('Feed texts:', confessions.map(c => c.text));
    process.exit(1);
  }
}

main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
