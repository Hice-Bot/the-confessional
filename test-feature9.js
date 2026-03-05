const http = require('http');

function get(path) {
  return new Promise((resolve, reject) => {
    http.get(`http://localhost:3003${path}`, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve({ status: res.statusCode, contentType: res.headers['content-type'], body: data }));
    }).on('error', reject);
  });
}

async function main() {
  // Step 1: GET /confessional (HTML) no auth
  const r1 = await get('/confessional');
  const s1 = r1.status === 200 && r1.contentType.includes('text/html') && r1.body.includes('<!DOCTYPE html>');
  process.stdout.write('Step 1 - GET /confessional: ' + (s1 ? 'PASS' : 'FAIL') + ' (status=' + r1.status + ')\n');

  // Step 2: GET /confessional/feed no auth
  const r2 = await get('/confessional/feed');
  const d2 = JSON.parse(r2.body);
  const s2 = r2.status === 200 && Array.isArray(d2.confessions) && typeof d2.count === 'number' && typeof d2.total === 'number';
  process.stdout.write('Step 2 - GET /confessional/feed: ' + (s2 ? 'PASS' : 'FAIL') + ' (status=' + r2.status + ', confessions=' + d2.confessions.length + ')\n');

  // Step 3: GET /confessional/count no auth
  const r3 = await get('/confessional/count');
  const d3 = JSON.parse(r3.body);
  const s3 = r3.status === 200 && typeof d3.count === 'number';
  process.stdout.write('Step 3 - GET /confessional/count: ' + (s3 ? 'PASS' : 'FAIL') + ' (status=' + r3.status + ', count=' + d3.count + ')\n');

  // Step 4: GET /confessional/skill.md no auth
  const r4 = await get('/confessional/skill.md');
  const s4 = r4.status === 200 && r4.contentType.includes('text/plain') && r4.body.length > 100;
  process.stdout.write('Step 4 - GET /confessional/skill.md: ' + (s4 ? 'PASS' : 'FAIL') + ' (status=' + r4.status + ', length=' + r4.body.length + ')\n');

  // Step 5: GET /api/health no auth
  const r5 = await get('/api/health');
  const d5 = JSON.parse(r5.body);
  const s5 = r5.status === 200 && d5.status === 'ok' && d5.database === 'connected';
  process.stdout.write('Step 5 - GET /api/health: ' + (s5 ? 'PASS' : 'FAIL') + ' (status=' + r5.status + ', db=' + d5.database + ')\n');

  const allPass = s1 && s2 && s3 && s4 && s5;
  process.stdout.write('\nAll steps: ' + (allPass ? 'PASS' : 'FAIL') + '\n');
}

main().catch(e => { process.stderr.write(e.message + '\n'); process.exit(1); });
