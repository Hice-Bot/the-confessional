const crypto = require('crypto');
const db = require('better-sqlite3')('./confessional.db');
const { v4: uuidv4 } = require('uuid');

// Step 1: Create session and submit confession via API (done via curl before this script)
// This script verifies the UNIQUE constraint on session_hash at the database level

// First, create a session directly
const sessionId = uuidv4();
const agentId = uuidv4();
db.prepare("INSERT INTO sessions (id, agent_id, status) VALUES (?, ?, 'open')").run(sessionId, agentId);
console.log('Created session:', sessionId);

// Compute session hash
const sessionHash = crypto.createHash('sha256').update(sessionId).digest('hex');
console.log('Session hash:', sessionHash.substring(0, 16) + '...');

// Insert first confession
const confessionId1 = uuidv4();
const originalText = 'UNIQUE_CONSTRAINT_TEST_103_ORIGINAL';
db.prepare("INSERT INTO confessions (id, text, session_hash) VALUES (?, ?, ?)").run(confessionId1, originalText, sessionHash);
console.log('Step 1: Inserted first confession successfully');

// Step 2: Attempt duplicate insert with same session_hash
const confessionId2 = uuidv4();
const duplicateText = 'UNIQUE_CONSTRAINT_TEST_103_DUPLICATE';
try {
  db.prepare("INSERT INTO confessions (id, text, session_hash) VALUES (?, ?, ?)").run(confessionId2, duplicateText, sessionHash);
  console.log('ERROR: Duplicate insert succeeded - UNIQUE constraint not enforced!');
  process.exit(1);
} catch (err) {
  console.log('Step 2: Duplicate insert correctly rejected:', err.message);
  if (err.message.includes('UNIQUE constraint failed')) {
    console.log('PASS: UNIQUE constraint on session_hash is working');
  } else {
    console.log('FAIL: Unexpected error type');
    process.exit(1);
  }
}

// Step 3: Verify original confession is untouched
const original = db.prepare("SELECT * FROM confessions WHERE id = ?").get(confessionId1);
if (original && original.text === originalText && original.session_hash === sessionHash) {
  console.log('Step 3: Original confession is untouched');
  console.log('  Text:', original.text);
  console.log('  Session hash matches:', original.session_hash === sessionHash);
} else {
  console.log('FAIL: Original confession was modified or missing');
  process.exit(1);
}

// Cleanup
db.prepare("DELETE FROM confessions WHERE id = ?").run(confessionId1);
db.prepare("DELETE FROM sessions WHERE id = ?").run(sessionId);
console.log('Cleanup done');
console.log('ALL STEPS PASSED');

db.close();
