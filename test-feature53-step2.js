// Step 2: After server restart, verify confession still exists
const http = require('http');
const crypto = require('crypto');
const fs = require('fs');

const BASE = 'http://localhost:3003';
const ADM_KEY = 'adm_test_key_001';

function request(method, path, body, headers) {
  headers = headers || {};
  return new Promise(function(resolve, reject) {
    const url = new URL(path, BASE);
    const opts = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname,
      method: method,
      headers: Object.assign({
        'Content-Type': 'application/json',
      }, headers),
    };
    const req = http.request(opts, function(res) {
      let data = '';
      res.on('data', function(d) { data += d; });
      res.on('end', function() {
        try { resolve({ status: res.statusCode, body: JSON.parse(data) }); }
        catch(e) { resolve({ status: res.statusCode, body: data }); }
      });
    });
    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

async function main() {
  // Load state from step 1
  const state = JSON.parse(fs.readFileSync('/mnt/c/Users/turke/the-confessional/test-feature53-state.json', 'utf8'));
  console.log('Loaded state:', JSON.stringify(state));

  // Step 4: Verify RESTART_PERSIST_TEST still appears in feed
  console.log('\n=== Step 4: Verify confession still in feed after restart ===');
  const feedRes = await request('GET', '/confessional/feed?limit=100', null, {});
  if (feedRes.status !== 200) throw new Error('Feed returned ' + feedRes.status);
  const found = feedRes.body.confessions.some(function(c) { return c.text === 'RESTART_PERSIST_TEST'; });
  if (!found) throw new Error('RESTART_PERSIST_TEST not found in feed after restart!');
  console.log('PASS: RESTART_PERSIST_TEST still appears in feed after restart');

  // Step 5: Verify count is consistent
  console.log('\n=== Step 5: Verify count is consistent ===');
  const countRes = await request('GET', '/confessional/count', null, {});
  console.log('Count after restart:', countRes.body.count);
  console.log('Count before restart:', state.countBefore);
  if (countRes.body.count !== state.countBefore) {
    throw new Error('Count changed! Before: ' + state.countBefore + ', After: ' + countRes.body.count);
  }
  console.log('PASS: Count is consistent after restart');

  // Cleanup: remove the test confession
  console.log('\n=== Cleanup ===');
  const Database = require('better-sqlite3');
  const db = new Database('/mnt/c/Users/turke/the-confessional/confessional.db');
  const sessionHash = crypto.createHash('sha256').update(state.sessionId).digest('hex');
  const confession = db.prepare('SELECT id FROM confessions WHERE session_hash = ?').get(sessionHash);
  if (confession) {
    db.prepare('DELETE FROM confessions WHERE id = ?').run(confession.id);
    console.log('Deleted test confession');
  }
  db.prepare('DELETE FROM session_attempts WHERE session_hash = ?').run(sessionHash);
  db.prepare('DELETE FROM sessions WHERE id = ?').run(state.sessionId);
  db.close();
  console.log('Test data cleaned up');

  // Clean up state file
  fs.unlinkSync('/mnt/c/Users/turke/the-confessional/test-feature53-state.json');

  console.log('\nALL 5 STEPS PASSED for Feature #53');
}

main().catch(function(err) {
  console.error('FAILED:', err.message);
  process.exit(1);
});
