const { execSync, spawn } = require('child_process');
const http = require('http');

function httpGet(path) {
  return new Promise((resolve, reject) => {
    http.get('http://localhost:3003' + path, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); }
        catch { resolve(data); }
      });
    }).on('error', reject);
  });
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function main() {
  // Step 1: Find and kill the server process
  console.log('=== Killing server ===');
  try {
    const psOut = execSync('ps aux', { encoding: 'utf8' });
    const serverLines = psOut.split('\n').filter(l => l.includes('node') && l.includes('server.js') && !l.includes('test-restart'));
    for (const line of serverLines) {
      const pid = line.trim().split(/\s+/)[1];
      console.log('Killing PID:', pid);
      try { process.kill(parseInt(pid), 'SIGTERM'); } catch(e) { console.log('Kill error:', e.message); }
    }
  } catch(e) {
    console.error('Error finding server:', e.message);
  }

  // Step 2: Wait for server to die
  console.log('Waiting 3 seconds...');
  await sleep(3000);

  // Verify server is dead
  try {
    await httpGet('/api/health');
    console.error('FAIL: Server is still running!');
    process.exit(1);
  } catch(e) {
    console.log('Confirmed: server is down');
  }

  // Step 3: Start server again
  console.log('\n=== Starting server ===');
  const server = spawn('node', ['src/server.js'], {
    cwd: '/mnt/c/Users/turke/the-confessional',
    detached: true,
    stdio: 'ignore'
  });
  server.unref();

  console.log('Waiting for server to start...');
  await sleep(3000);

  // Step 4: Check health
  console.log('\n=== Checking health ===');
  try {
    const health = await httpGet('/api/health');
    console.log('Health:', JSON.stringify(health));
  } catch(e) {
    console.error('FAIL: Server did not start:', e.message);
    process.exit(1);
  }

  // Step 5: Check feed for persisted confession
  console.log('\n=== Checking feed for persistence ===');
  const feed = await httpGet('/confessional/feed');
  const confessions = Array.isArray(feed) ? feed : (feed.confessions || []);
  console.log('Total confessions in feed:', confessions.length);

  const found = confessions.some(c => c.text && c.text.includes('Persistence test confession'));
  console.log('Persistence test confession found:', found);

  if (found) {
    const match = confessions.find(c => c.text && c.text.includes('Persistence test confession'));
    console.log('Matched text:', match.text);
    console.log('\nPASSED: Data persists across server restart!');
  } else {
    console.log('Confessions found:', confessions.map(c => c.text).join(', '));
    console.error('\nFAILED: Confession not found after restart!');
    process.exit(1);
  }
}

main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
