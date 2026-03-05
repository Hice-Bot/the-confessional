/**
 * Test Feature #101: Concurrent submissions to different sessions succeed
 *
 * Steps:
 * 1. Create 5 separate sessions
 * 2. Submit confessions to all 5 sessions simultaneously (parallel requests)
 * 3. Verify all 5 return 200 {received: true}
 * 4. GET /confessional/feed → verify all 5 confessions appear
 * 5. Verify no data corruption or missing entries
 */

const BASE = 'http://localhost:3003';
const ADMIN_KEY = 'adm_test_key_001';
const AGENT_KEY = 'agt_test_key_001';
const AGENT_KEY_2 = 'agt_test_key_002';

// Use alphanumeric marker to avoid PII scrubbing of numeric timestamps
function randomAlpha(len) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
  let result = '';
  for (let i = 0; i < len; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

async function createSession(agentId) {
  const resp = await fetch(`${BASE}/confessional/sessions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${ADMIN_KEY}`
    },
    body: JSON.stringify({ agent_id: agentId })
  });
  if (resp.status !== 200) {
    throw new Error(`Failed to create session: ${resp.status}`);
  }
  return resp.json();
}

async function submitConfession(sessionId, text, agentKey) {
  const resp = await fetch(`${BASE}/confessional/submit`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${agentKey}`,
      'X-Session-ID': sessionId
    },
    body: JSON.stringify({ text })
  });
  return { status: resp.status, body: await resp.json() };
}

async function getFeed(limit) {
  const resp = await fetch(`${BASE}/confessional/feed?limit=${limit || 100}`);
  return resp.json();
}

async function test() {
  const MARKER = `CONCUR_${randomAlpha(8)}`;
  console.log(`Using marker: ${MARKER}`);

  // Step 1: Create 5 separate sessions
  console.log('\n--- Step 1: Create 5 separate sessions ---');
  const { randomUUID } = require('crypto');
  const agentIds = Array.from({ length: 5 }, () => randomUUID());
  const sessions = [];

  for (let i = 0; i < 5; i++) {
    const session = await createSession(agentIds[i]);
    sessions.push(session);
    console.log(`  Session ${i + 1}: ${session.session_id} (status: ${session.status})`);
  }

  if (sessions.length !== 5) {
    console.log('FAIL: Could not create 5 sessions');
    process.exit(1);
  }
  console.log('PASS: 5 sessions created');

  // Step 2: Submit confessions to all 5 sessions simultaneously
  console.log('\n--- Step 2: Submit confessions to all 5 simultaneously ---');
  const confessionTexts = sessions.map((s, i) => `${MARKER}_S${i + 1}`);

  // Alternate between two agent keys to avoid rate limiting
  const keys = [AGENT_KEY, AGENT_KEY_2, AGENT_KEY, AGENT_KEY_2, AGENT_KEY];

  const submitPromises = sessions.map((session, i) =>
    submitConfession(session.session_id, confessionTexts[i], keys[i])
  );

  // Fire all 5 in parallel
  const results = await Promise.all(submitPromises);

  // Step 3: Verify all 5 return 200 {received: true}
  console.log('\n--- Step 3: Verify all 5 return 200 {received: true} ---');
  let allPassed = true;
  for (let i = 0; i < results.length; i++) {
    const { status, body } = results[i];
    const pass = status === 200 && body.received === true;
    console.log(`  Session ${i + 1}: HTTP ${status}, body=${JSON.stringify(body)} ${pass ? 'PASS' : 'FAIL'}`);
    if (!pass) allPassed = false;
  }

  if (!allPassed) {
    console.log('FAIL: Not all submissions returned 200 {received: true}');
    process.exit(1);
  }
  console.log('PASS: All 5 submissions returned 200 {received: true}');

  // Step 4: GET /confessional/feed → verify all 5 confessions appear
  console.log('\n--- Step 4: Verify all 5 confessions appear in feed ---');
  const feed = await getFeed(100);
  const feedTexts = feed.confessions.map(c => c.text);

  let allInFeed = true;
  for (let i = 0; i < confessionTexts.length; i++) {
    const found = feedTexts.includes(confessionTexts[i]);
    console.log(`  "${confessionTexts[i]}": ${found ? 'FOUND' : 'MISSING'}`);
    if (!found) allInFeed = false;
  }

  if (!allInFeed) {
    console.log('FAIL: Not all confessions found in feed');
    process.exit(1);
  }
  console.log('PASS: All 5 confessions appear in feed');

  // Step 5: Verify no data corruption or missing entries
  console.log('\n--- Step 5: Verify no data corruption ---');

  // Check via agent feed (includes created_at)
  const agentResp = await fetch(`${BASE}/confessional/feed/agent?limit=100`, {
    headers: { 'Authorization': `Bearer ${AGENT_KEY}` }
  });
  const agentFeed = await agentResp.json();
  const agentTexts = agentFeed.confessions.map(c => c.text);

  let noDuplicates = true;
  let noCorruption = true;

  for (const text of confessionTexts) {
    const matches = agentTexts.filter(t => t === text);
    if (matches.length > 1) {
      console.log(`  FAIL: Duplicate entry for "${text}" (${matches.length} copies)`);
      noDuplicates = false;
    }
    if (matches.length === 0) {
      console.log(`  FAIL: Missing entry for "${text}"`);
      noCorruption = false;
    }
  }

  // Check that each confession has valid created_at timestamp
  const markerConfessions = agentFeed.confessions.filter(c => c.text.startsWith(MARKER));
  for (const c of markerConfessions) {
    if (!c.created_at || isNaN(new Date(c.created_at).getTime())) {
      console.log(`  FAIL: Invalid created_at for "${c.text}": ${c.created_at}`);
      noCorruption = false;
    }
  }

  // Check exactly 5 entries with our marker (no duplicates, no missing)
  const markerCount = agentTexts.filter(t => t.startsWith(MARKER)).length;
  if (markerCount !== 5) {
    console.log(`  FAIL: Expected 5 entries with marker, found ${markerCount}`);
    noCorruption = false;
  }

  if (noDuplicates && noCorruption) {
    console.log(`PASS: No duplicates, no missing entries (exactly ${markerCount}/5), all timestamps valid`);
  } else {
    console.log('FAIL: Data corruption detected');
    process.exit(1);
  }

  // Cleanup: Delete test confessions
  console.log('\n--- Cleanup: Deleting test data ---');
  const Database = require('better-sqlite3');
  const db = new Database('./confessional.db');

  for (const text of confessionTexts) {
    const confession = db.prepare('SELECT id FROM confessions WHERE text = ?').get(text);
    if (confession) {
      db.prepare('DELETE FROM confessions WHERE id = ?').run(confession.id);
      console.log(`  Deleted confession: ${text}`);
    }
  }

  // Clean up sessions and attempts
  const { sha256 } = require('./src/utils/hash');
  for (const session of sessions) {
    const hash = sha256(session.session_id);
    db.prepare('DELETE FROM session_attempts WHERE session_hash = ?').run(hash);
    db.prepare('DELETE FROM sessions WHERE id = ?').run(session.session_id);
  }
  console.log(`  Cleaned up ${sessions.length} sessions and attempts`);

  // Also clean up the PII-scrubbed confessions from first test run
  const scrubbed = db.prepare("SELECT id, text FROM confessions WHERE text LIKE 'CONCURRENT_TEST_%'").all();
  for (const c of scrubbed) {
    db.prepare('DELETE FROM confessions WHERE id = ?').run(c.id);
    console.log(`  Cleaned leftover: ${c.text}`);
  }

  db.close();

  console.log('\n=== ALL STEPS PASSED: Feature #101 verified ===');
}

test().catch(err => {
  console.error('Test error:', err);
  process.exit(1);
});
