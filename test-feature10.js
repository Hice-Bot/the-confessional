const http = require('http');
const crypto = require('crypto');
const Database = require('better-sqlite3');

const ADM_KEY = 'adm_test_key_001';
const AGT_KEY = 'agt_test_key_001';
const DB_PATH = '/mnt/c/Users/turke/the-confessional/confessional.db';

function request(method, path, body, headers) {
  return new Promise((resolve, reject) => {
    const opts = {
      hostname: 'localhost',
      port: 3003,
      path,
      method,
      headers: { ...headers }
    };
    if (body) {
      const payload = JSON.stringify(body);
      opts.headers['Content-Type'] = 'application/json';
      opts.headers['Content-Length'] = Buffer.byteLength(payload);
    }
    const req = http.request(opts, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve({ status: res.statusCode, body: data ? JSON.parse(data) : null }));
    });
    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

async function main() {
  const rand = Math.random().toString(36).substring(2, 10).toUpperCase();
  const uniqueText = 'HASH_ISOLATION_TEST_' + rand;

  // Step 1: Create a session
  const sessRes = await request('POST', '/confessional/sessions',
    { agent_id: crypto.randomUUID() },
    { 'Authorization': 'Bearer ' + ADM_KEY }
  );
  const sessionId = sessRes.body.session_id;
  process.stdout.write('Step 1 - Created session: ' + sessionId + '\n');

  // Step 2: Submit a confession
  const subRes = await request('POST', '/confessional/submit',
    { text: uniqueText },
    { 'Authorization': 'Bearer ' + AGT_KEY, 'X-Session-ID': sessionId }
  );
  process.stdout.write('Step 2 - Submit result: status=' + subRes.status + ' received=' + subRes.body.received + '\n');

  // Step 3: Query confessions table directly
  const db = new Database(DB_PATH, { readonly: true });
  const row = db.prepare("SELECT * FROM confessions WHERE text = ?").get(uniqueText);
  if (!row) {
    process.stdout.write('ERROR: Confession not found in database\n');
    db.close();
    return;
  }
  process.stdout.write('Step 3 - Found confession in DB, session_hash: ' + row.session_hash + '\n');

  // Step 4: Verify session_hash != session_id
  const hashNotRaw = row.session_hash !== sessionId;
  process.stdout.write('Step 4 - session_hash != session_id: ' + (hashNotRaw ? 'PASS' : 'FAIL') + '\n');

  // Step 5: Compute SHA-256 of session_id
  const expectedHash = crypto.createHash('sha256').update(sessionId).digest('hex');
  process.stdout.write('Step 5 - Computed SHA-256: ' + expectedHash + '\n');

  // Step 6: Verify session_hash equals computed hash
  const hashMatch = row.session_hash === expectedHash;
  process.stdout.write('Step 6 - session_hash matches SHA-256: ' + (hashMatch ? 'PASS' : 'FAIL') + '\n');
  process.stdout.write('  DB value:    ' + row.session_hash + '\n');
  process.stdout.write('  SHA-256:     ' + expectedHash + '\n');

  // Step 7: Verify no column contains the raw session_id
  const columns = Object.keys(row);
  let rawFound = false;
  for (const col of columns) {
    if (String(row[col]) === sessionId) {
      rawFound = true;
      process.stdout.write('  WARNING: Column "' + col + '" contains raw session_id!\n');
    }
  }
  process.stdout.write('Step 7 - No column contains raw session_id: ' + (!rawFound ? 'PASS' : 'FAIL') + '\n');

  const allPass = hashNotRaw && hashMatch && !rawFound;
  process.stdout.write('\nAll steps: ' + (allPass ? 'PASS' : 'FAIL') + '\n');

  // Cleanup: delete the test confession
  db.close();
  const db2 = new Database(DB_PATH);
  db2.prepare("DELETE FROM confessions WHERE text = ?").run(uniqueText);
  db2.prepare("DELETE FROM session_attempts WHERE session_hash = ?").run(expectedHash);
  db2.close();
  process.stdout.write('Cleanup: test data removed\n');
}

main().catch(e => { process.stderr.write(e.message + '\n'); process.exit(1); });
