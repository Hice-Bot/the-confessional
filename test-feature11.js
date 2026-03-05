const http = require('http');

function request(method, path, extraHeaders) {
  return new Promise((resolve, reject) => {
    const opts = {
      hostname: 'localhost',
      port: 3003,
      path,
      method,
      headers: { ...extraHeaders }
    };
    const req = http.request(opts, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body: data }));
    });
    req.on('error', reject);
    req.end();
  });
}

async function main() {
  // Step 1: OPTIONS preflight to /confessional/feed
  const r1 = await request('OPTIONS', '/confessional/feed', {
    'Origin': 'https://example.com',
    'Access-Control-Request-Method': 'GET'
  });
  const acao1 = r1.headers['access-control-allow-origin'];
  const s1 = acao1 === '*' || acao1 === 'https://example.com';
  process.stdout.write('Step 1 - OPTIONS /confessional/feed:\n');
  process.stdout.write('  Status: ' + r1.status + '\n');
  process.stdout.write('  Access-Control-Allow-Origin: ' + acao1 + '\n');
  process.stdout.write('  Result: ' + (s1 ? 'PASS' : 'FAIL') + '\n\n');

  // Step 2: OPTIONS preflight to /confessional/skill.md
  const r2 = await request('OPTIONS', '/confessional/skill.md', {
    'Origin': 'https://another-site.com',
    'Access-Control-Request-Method': 'GET'
  });
  const acao2 = r2.headers['access-control-allow-origin'];
  const s2 = acao2 === '*' || acao2 === 'https://another-site.com';
  process.stdout.write('Step 2 - OPTIONS /confessional/skill.md:\n');
  process.stdout.write('  Status: ' + r2.status + '\n');
  process.stdout.write('  Access-Control-Allow-Origin: ' + acao2 + '\n');
  process.stdout.write('  Result: ' + (s2 ? 'PASS' : 'FAIL') + '\n\n');

  // Step 3: GET /confessional/feed with Origin header
  const r3 = await request('GET', '/confessional/feed', {
    'Origin': 'https://example.com'
  });
  const acao3 = r3.headers['access-control-allow-origin'];
  const s3 = r3.status === 200 && (acao3 === '*' || acao3 === 'https://example.com');
  process.stdout.write('Step 3 - GET /confessional/feed with Origin:\n');
  process.stdout.write('  Status: ' + r3.status + '\n');
  process.stdout.write('  Access-Control-Allow-Origin: ' + acao3 + '\n');
  process.stdout.write('  Result: ' + (s3 ? 'PASS' : 'FAIL') + '\n\n');

  // Step 4: Verify human feed endpoints are accessible cross-origin
  // Also test /confessional/count and /confessional itself
  const r4a = await request('GET', '/confessional/count', {
    'Origin': 'https://cross-origin-test.com'
  });
  const acao4a = r4a.headers['access-control-allow-origin'];
  const s4a = r4a.status === 200 && (acao4a === '*' || acao4a === 'https://cross-origin-test.com');

  const r4b = await request('GET', '/confessional', {
    'Origin': 'https://cross-origin-test.com'
  });
  const acao4b = r4b.headers['access-control-allow-origin'];
  const s4b = r4b.status === 200 && (acao4b === '*' || acao4b === 'https://cross-origin-test.com');

  const s4 = s4a && s4b;
  process.stdout.write('Step 4 - Cross-origin accessibility:\n');
  process.stdout.write('  /confessional/count ACAO: ' + acao4a + ' (' + (s4a ? 'PASS' : 'FAIL') + ')\n');
  process.stdout.write('  /confessional ACAO: ' + acao4b + ' (' + (s4b ? 'PASS' : 'FAIL') + ')\n');
  process.stdout.write('  Result: ' + (s4 ? 'PASS' : 'FAIL') + '\n\n');

  const allPass = s1 && s2 && s3 && s4;
  process.stdout.write('All steps: ' + (allPass ? 'PASS' : 'FAIL') + '\n');
}

main().catch(e => { process.stderr.write(e.message + '\n'); process.exit(1); });
