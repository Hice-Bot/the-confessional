const { execSync } = require('child_process');
const http = require('http');

const BASE = 'http://localhost:3003';
const UNIQUE_TEXT = 'PERSIST_TEST_789_FEAT20_XYQWZ';

function request(method, path) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE);
    const opts = {
      method,
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search
    };
    const req = http.request(opts, (res) => {
      let chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => {
        const text = Buffer.concat(chunks).toString();
        let json;
        try { json = JSON.parse(text); } catch(e) { json = null; }
        resolve({ status: res.statusCode, body: json });
      });
    });
    req.on('error', reject);
    req.end();
  });
}

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

function waitForServer(maxRetries) {
  return new Promise((resolve, reject) => {
    let attempts = 0;
    function tryConnect() {
      attempts++;
      const req = http.get(BASE + '/api/health', (res) => {
        let d = [];
        res.on('data', c => d.push(c));
        res.on('end', () => resolve(true));
      });
      req.on('error', () => {
        if (attempts >= maxRetries) {
          reject(new Error('Server did not start'));
        } else {
          setTimeout(tryConnect, 1000);
        }
      });
    }
    tryConnect();
  });
}

async function main() {
  console.log('=== Server Restart Persistence Test ===\n');

  // Step 1: Verify data exists before restart
  console.log('Step 1: Verify data exists before restart...');
  const feed1 = await request('GET', '/confessional/feed?limit=100');
  const found1 = feed1.body.confessions.some(c => c.text === UNIQUE_TEXT);
  console.log('  Found before restart:', found1);
  if (!found1) {
    console.log('SKIP: Test data not found, cannot test restart persistence');
    process.exit(0);
  }

  // Step 2: Kill the server
  console.log('\nStep 2: Stopping server...');
  try {
    const psOutput = execSync('ps aux').toString();
    const serverLines = psOutput.split('\n').filter(l => l.includes('node') && l.includes('server.js'));
    serverLines.forEach(line => {
      const parts = line.trim().split(/\s+/);
      const pid = parts[1];
      console.log('  Killing PID:', pid);
      try { execSync('kill ' + pid); } catch(e) { /* already dead */ }
    });
  } catch(e) {
    console.log('  Error finding process:', e.message);
  }

  // Wait for server to stop
  await sleep(2000);
  console.log('  Server stopped');

  // Step 3: Restart the server
  console.log('\nStep 3: Restarting server...');
  const child = require('child_process').spawn('node', ['src/server.js'], {
    cwd: '/mnt/c/Users/turke/the-confessional',
    detached: true,
    stdio: 'ignore',
    env: { ...process.env }
  });
  child.unref();

  // Wait for server to be ready
  console.log('  Waiting for server to start...');
  await waitForServer(15);
  console.log('  Server is up');

  // Step 4: Verify data still exists
  console.log('\nStep 4: Verify data persists after restart...');
  const feed2 = await request('GET', '/confessional/feed?limit=100');
  const found2 = feed2.body.confessions.some(c => c.text === UNIQUE_TEXT);
  console.log('  Found after restart:', found2);
  console.log('  Count after restart:', feed2.body.count);

  if (found2) {
    console.log('\nPASS: Data persists after server restart');
  } else {
    console.log('\nFAIL: Data lost after server restart');
    process.exit(1);
  }
}

main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
