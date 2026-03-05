const http = require('http');
const crypto = require('crypto');

const BASE = 'http://localhost:3003';
const ADM_KEY = 'adm_test_key_001';

function request(method, path, body, headers) {
  headers = headers || {};
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE);
    const opts = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname,
      method,
      headers: Object.assign({
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + ADM_KEY,
      }, headers),
    };
    const req = http.request(opts, (res) => {
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
  const agentId = crypto.randomUUID();

  // Step 1: Create session → verify status='open'
  console.log('\n=== Step 1: Create session → verify status=open ===');
  const createRes = await request('POST', '/confessional/sessions', { agent_id: agentId });
  console.log('Status:', createRes.status);
  console.log('Body:', JSON.stringify(createRes.body));
  if (createRes.status !== 200) throw new Error('Expected 200 on session create');
  if (createRes.body.status !== 'open') throw new Error('Expected status open, got ' + createRes.body.status);
  console.log('PASS: Session created with status=open');

  const sessionId = createRes.body.session_id;

  // Step 2: Query sessions table directly → verify status='open'
  console.log('\n=== Step 2: Query sessions table directly ===');
  const Database = require('better-sqlite3');
  const db = new Database('/mnt/c/Users/turke/the-confessional/confessional.db', { readonly: true });
  const row = db.prepare('SELECT * FROM sessions WHERE id = ?').get(sessionId);
  console.log('DB row:', JSON.stringify(row));
  if (!row) throw new Error('Session not found in DB');
  if (row.status !== 'open') throw new Error('Expected status open in DB, got ' + row.status);
  console.log('PASS: Database confirms status=open');

  // Step 3: Close session → verify response status='closed'
  console.log('\n=== Step 3: Close session → verify response status=closed ===');
  const closeRes = await request('POST', '/confessional/sessions/' + sessionId + '/close');
  console.log('Status:', closeRes.status);
  console.log('Body:', JSON.stringify(closeRes.body));
  if (closeRes.status !== 200) throw new Error('Expected 200 on session close');
  if (closeRes.body.status !== 'closed') throw new Error('Expected status closed, got ' + closeRes.body.status);
  console.log('PASS: Close response shows status=closed');

  // Step 4: Query sessions table directly → verify status='closed'
  console.log('\n=== Step 4: Query sessions table directly after close ===');
  db.close();
  const db2 = new Database('/mnt/c/Users/turke/the-confessional/confessional.db', { readonly: true });
  const rowAfter = db2.prepare('SELECT * FROM sessions WHERE id = ?').get(sessionId);
  console.log('DB row:', JSON.stringify(rowAfter));
  if (rowAfter.status !== 'closed') throw new Error('Expected status closed in DB, got ' + rowAfter.status);
  console.log('PASS: Database confirms status=closed');

  // Step 5: Verify sessions table has created_at timestamp
  console.log('\n=== Step 5: Verify created_at timestamp ===');
  if (!rowAfter.created_at) throw new Error('No created_at in sessions table');
  console.log('created_at:', rowAfter.created_at);
  const ts = new Date(rowAfter.created_at);
  if (isNaN(ts.getTime())) throw new Error('created_at is not a valid date: ' + rowAfter.created_at);
  console.log('PASS: created_at is a valid timestamp');

  db2.close();

  // Cleanup: delete the test session
  console.log('\n=== Cleanup ===');
  const db3 = new Database('/mnt/c/Users/turke/the-confessional/confessional.db');
  db3.prepare('DELETE FROM sessions WHERE id = ?').run(sessionId);
  db3.close();
  console.log('Test session cleaned up');

  console.log('\nALL 5 STEPS PASSED for Feature #51');
}

main().catch(function(err) {
  console.error('\nFAILED:', err.message);
  process.exit(1);
});
