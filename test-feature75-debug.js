// Debug: Check agent feed response structure
const http = require('http');
const fs = require('fs');

function request(method, path, headers = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, 'http://localhost:3003');
    const opts = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      method,
      headers
    };
    const req = http.request(opts, (res) => {
      let chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => {
        resolve({ status: res.statusCode, body: Buffer.concat(chunks).toString() });
      });
    });
    req.on('error', reject);
    req.end();
  });
}

async function run() {
  const out = [];

  // Check human feed structure
  const humanRes = await request('GET', '/confessional/feed?limit=2');
  out.push('Human feed status: ' + humanRes.status);
  out.push('Human feed body keys: ' + Object.keys(JSON.parse(humanRes.body)).join(', '));
  out.push('Human feed snippet: ' + humanRes.body.substring(0, 300));

  // Check agent feed structure
  const agentRes = await request('GET', '/confessional/feed/agent?limit=2', {
    'Authorization': 'Bearer agt_test_key_001'
  });
  out.push('');
  out.push('Agent feed status: ' + agentRes.status);
  out.push('Agent feed body keys: ' + Object.keys(JSON.parse(agentRes.body)).join(', '));
  out.push('Agent feed snippet: ' + agentRes.body.substring(0, 300));

  // Check count
  const countRes = await request('GET', '/confessional/count');
  out.push('');
  out.push('Count: ' + countRes.body);

  fs.writeFileSync('/tmp/f75_debug.txt', out.join('\n'));
}

run().catch(e => {
  fs.writeFileSync('/tmp/f75_debug.txt', 'ERROR: ' + e.message + '\n' + e.stack);
});
