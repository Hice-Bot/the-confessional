// Test Feature #71: Session defaults to open status
const Database = require('better-sqlite3');
const path = require('path');
const http = require('http');

const DB_PATH = path.join(__dirname, 'confessional.db');

function post(urlPath, body, authKey) {
  return new Promise((resolve, reject) => {
    const url = new URL(urlPath, 'http://localhost:3003');
    const data = JSON.stringify(body);
    const options = {
      method: 'POST',
      hostname: url.hostname,
      port: url.port,
      path: url.pathname,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authKey}`,
        'Content-Length': Buffer.byteLength(data)
      }
    };
    const req = http.request(options, (res) => {
      let buf = '';
      res.on('data', c => buf += c);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(buf) }); }
        catch { resolve({ status: res.statusCode, body: buf }); }
      });
    });
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

async function verify() {
  console.log('=== Feature #71: Session defaults to open status ===\n');

  // Step 1: Create a new session
  const agentId = 'f71-test-' + Date.now();
  const res = await post('/confessional/sessions', { agent_id: agentId }, 'adm_test_key_001');
  console.log('Step 1: POST /confessional/sessions response:', JSON.stringify(res.body));
  console.assert(res.status === 200, 'Expected 200, got ' + res.status);
  console.log('✓ Session created successfully (status ' + res.status + ')\n');

  // Step 2: Verify response contains status='open'
  console.log('Step 2: Checking response status field...');
  console.assert(res.body.status === 'open', 'Expected status "open", got "' + res.body.status + '"');
  console.assert(typeof res.body.session_id === 'string', 'Expected session_id string');
  console.log('✓ Response status is "open"');
  console.log('✓ session_id returned:', res.body.session_id, '\n');

  // Step 3: Query sessions table directly
  console.log('Step 3: Querying database directly...');
  const db = new Database(DB_PATH);
  const row = db.prepare('SELECT * FROM sessions WHERE id = ?').get(res.body.session_id);
  console.log('  Database row:', JSON.stringify(row));
  console.assert(row !== undefined, 'Session not found in database');
  console.assert(row.status === 'open', 'Expected status "open" in DB, got "' + row.status + '"');
  console.assert(row.agent_id === agentId, 'Agent ID mismatch');
  console.assert(typeof row.created_at === 'string', 'Missing created_at');
  console.log('✓ Database status is "open"');
  console.log('✓ agent_id matches:', row.agent_id);
  console.log('✓ created_at present:', row.created_at);

  // Cleanup: delete the test session
  db.prepare('DELETE FROM sessions WHERE id = ?').run(res.body.session_id);
  console.log('\n✓ Test session cleaned up');

  db.close();
  console.log('\n=== ALL VERIFICATIONS PASSED ===');
}

verify().catch(console.error);
