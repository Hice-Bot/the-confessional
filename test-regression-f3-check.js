const http = require('http');

const BASE = 'http://localhost:3003';

function request(method, path, headers = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE);
    const opts = {
      method,
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      headers: { 'Content-Type': 'application/json', ...headers },
    };
    const req = http.request(opts, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(data) }); }
        catch { resolve({ status: res.statusCode, body: data }); }
      });
    });
    req.on('error', reject);
    req.end();
  });
}

async function main() {
  // Get latest confessions to see what format they have
  const feedRes = await request('GET', '/confessional/feed');
  console.log('Feed status:', feedRes.status);
  console.log('Total confessions:', feedRes.body.total);
  console.log('Count in page:', feedRes.body.count);
  console.log('\nFirst 5 confessions:');
  (feedRes.body.confessions || []).slice(0, 5).forEach((c, i) => {
    console.log(`  ${i + 1}. "${c.text}"`);
  });

  // Check if there is any confession starting with "Regression test confession"
  const allMatch = (feedRes.body.confessions || []).filter(c => c.text.startsWith('Regression test confession'));
  console.log('\nConfessions matching "Regression test confession":', allMatch.length);
  allMatch.forEach((c, i) => console.log(`  ${i + 1}. "${c.text}"`));
}

main().catch(err => {
  console.error('ERROR:', err.message);
  process.exit(1);
});
