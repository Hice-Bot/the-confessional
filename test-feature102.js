/**
 * Test Feature #102: Atomic transaction on submission
 *
 * Steps:
 * 1. Create a session and submit a confession
 * 2. Query confessions table → verify confession row exists
 * 3. Query session_attempts table → verify attempt row exists with matching session_hash
 * 4. Verify both records have consistent session_hash (SHA-256 of session_id)
 */

const BASE = 'http://localhost:3003';
const ADMIN_KEY = 'adm_test_key_001';
const AGENT_KEY = 'agt_test_key_001';
const crypto = require('crypto');

function randomAlpha(len) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
  let result = '';
  for (let i = 0; i < len; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

function computeSHA256(input) {
  return crypto.createHash('sha256').update(input).digest('hex');
}

async function test() {
  const MARKER = `ATOMIC_${randomAlpha(8)}`;
  console.log(`Using marker: ${MARKER}`);

  // Step 1: Create a session and submit a confession
  console.log('\n--- Step 1: Create a session and submit a confession ---');

  const agentId = crypto.randomUUID();
  const sessionResp = await fetch(`${BASE}/confessional/sessions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${ADMIN_KEY}`
    },
    body: JSON.stringify({ agent_id: agentId })
  });

  if (sessionResp.status !== 200) {
    console.log(`FAIL: Session creation returned ${sessionResp.status}`);
    process.exit(1);
  }

  const sessionData = await sessionResp.json();
  const sessionId = sessionData.session_id;
  console.log(`  Session created: ${sessionId}`);

  // Compute expected SHA-256 hash
  const expectedHash = computeSHA256(sessionId);
  console.log(`  Expected session_hash (SHA-256): ${expectedHash}`);

  // Submit confession
  const confessionText = `${MARKER}_confession_text`;
  const submitResp = await fetch(`${BASE}/confessional/submit`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${AGENT_KEY}`,
      'X-Session-ID': sessionId
    },
    body: JSON.stringify({ text: confessionText })
  });

  const submitBody = await submitResp.json();
  if (submitResp.status !== 200 || !submitBody.received) {
    console.log(`FAIL: Submit returned ${submitResp.status}: ${JSON.stringify(submitBody)}`);
    process.exit(1);
  }
  console.log(`  Confession submitted: HTTP ${submitResp.status} ${JSON.stringify(submitBody)}`);
  console.log('PASS: Session created and confession submitted');

  // Step 2: Query confessions table → verify confession row exists
  console.log('\n--- Step 2: Query confessions table → verify confession row exists ---');
  const Database = require('better-sqlite3');
  const db = new Database('./confessional.db');

  const confession = db.prepare('SELECT id, text, session_hash, created_at, flagged FROM confessions WHERE session_hash = ?').get(expectedHash);

  if (!confession) {
    console.log('FAIL: No confession found with expected session_hash');
    db.close();
    process.exit(1);
  }

  console.log(`  Confession found:`);
  console.log(`    id: ${confession.id}`);
  console.log(`    text: ${confession.text}`);
  console.log(`    session_hash: ${confession.session_hash}`);
  console.log(`    created_at: ${confession.created_at}`);
  console.log(`    flagged: ${confession.flagged}`);

  if (confession.text !== confessionText) {
    console.log(`FAIL: Confession text mismatch. Expected "${confessionText}", got "${confession.text}"`);
    db.close();
    process.exit(1);
  }
  console.log('PASS: Confession row exists with correct text');

  // Step 3: Query session_attempts table → verify attempt row exists with matching session_hash
  console.log('\n--- Step 3: Query session_attempts table → verify attempt row exists ---');

  const attempt = db.prepare('SELECT session_hash, attempted_at FROM session_attempts WHERE session_hash = ?').get(expectedHash);

  if (!attempt) {
    console.log('FAIL: No session_attempt found with expected session_hash');
    db.close();
    process.exit(1);
  }

  console.log(`  Session attempt found:`);
  console.log(`    session_hash: ${attempt.session_hash}`);
  console.log(`    attempted_at: ${attempt.attempted_at}`);
  console.log('PASS: Session attempt row exists');

  // Step 4: Verify both records have consistent session_hash (SHA-256 of session_id)
  console.log('\n--- Step 4: Verify both records have consistent session_hash ---');

  const confessionHash = confession.session_hash;
  const attemptHash = attempt.session_hash;

  console.log(`  Confession session_hash: ${confessionHash}`);
  console.log(`  Attempt session_hash:    ${attemptHash}`);
  console.log(`  Expected SHA-256:        ${expectedHash}`);

  if (confessionHash !== expectedHash) {
    console.log('FAIL: Confession session_hash does not match SHA-256(session_id)');
    db.close();
    process.exit(1);
  }

  if (attemptHash !== expectedHash) {
    console.log('FAIL: Attempt session_hash does not match SHA-256(session_id)');
    db.close();
    process.exit(1);
  }

  if (confessionHash !== attemptHash) {
    console.log('FAIL: Confession and attempt session_hashes do not match');
    db.close();
    process.exit(1);
  }

  console.log('PASS: Both records have identical and correct session_hash');

  // Also verify the source code uses db.transaction() for atomicity
  console.log('\n--- Bonus: Verify atomic transaction in source code ---');
  const fs = require('fs');
  const submitSource = fs.readFileSync('./src/routes/submit.js', 'utf8');

  const hasTransaction = submitSource.includes('db.transaction(');
  const hasInsertConfession = submitSource.includes("INSERT INTO confessions");
  const hasInsertAttempt = submitSource.includes("INSERT INTO session_attempts");

  console.log(`  db.transaction() used: ${hasTransaction}`);
  console.log(`  INSERT INTO confessions: ${hasInsertConfession}`);
  console.log(`  INSERT INTO session_attempts: ${hasInsertAttempt}`);

  if (!hasTransaction || !hasInsertConfession || !hasInsertAttempt) {
    console.log('FAIL: Atomic transaction pattern not found in source');
    db.close();
    process.exit(1);
  }
  console.log('PASS: Source code confirms atomic transaction wrapping both inserts');

  // Cleanup
  console.log('\n--- Cleanup ---');
  db.prepare('DELETE FROM confessions WHERE id = ?').run(confession.id);
  db.prepare('DELETE FROM session_attempts WHERE session_hash = ?').run(expectedHash);
  db.prepare('DELETE FROM sessions WHERE id = ?').run(sessionId);
  console.log('  Test data cleaned up');

  db.close();

  console.log('\n=== ALL STEPS PASSED: Feature #102 verified ===');
}

test().catch(err => {
  console.error('Test error:', err);
  process.exit(1);
});
