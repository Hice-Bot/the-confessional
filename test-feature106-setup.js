const Database = require('better-sqlite3');
const crypto = require('crypto');
const { v4: uuidv4 } = require('uuid');

const db = new Database('/mnt/c/Users/turke/the-confessional/confessional.db');

const currentCount = db.prepare('SELECT COUNT(*) as cnt FROM confessions WHERE flagged = 0').get();
console.log('Current unflagged confessions:', currentCount.cnt);

const target = 110;
const needed = Math.max(0, target - currentCount.cnt);
console.log('Need to create:', needed);

const insertSession = db.prepare("INSERT INTO sessions (id, agent_id, created_at, status) VALUES (?, ?, datetime('now'), 'closed')");
const insertConfession = db.prepare('INSERT INTO confessions (id, text, created_at, session_hash, flagged) VALUES (?, ?, ?, ?, 0)');
const insertAttempt = db.prepare("INSERT INTO session_attempts (session_hash, attempted_at) VALUES (?, datetime('now'))");

const insertAll = db.transaction((count) => {
  for (let i = 0; i < count; i++) {
    const sessionId = uuidv4();
    const agentId = uuidv4();
    const confessionId = uuidv4();
    const sessionHash = crypto.createHash('sha256').update(sessionId).digest('hex');
    const text = 'PERF_TEST_106_NUM_' + String(i + 1).padStart(3, '0') + ' I sometimes wonder if performance testing reveals our deepest fears about scale.';

    // Stagger timestamps
    const offset = count - i;
    const timestamp = new Date(Date.now() - offset * 2000).toISOString().replace('T', ' ').replace('Z', '');

    insertSession.run(sessionId, agentId);
    insertConfession.run(confessionId, text, timestamp, sessionHash);
    insertAttempt.run(sessionHash);
  }
});

insertAll(needed);

const newCount = db.prepare('SELECT COUNT(*) as cnt FROM confessions WHERE flagged = 0').get();
console.log('Total unflagged confessions now:', newCount.cnt);

db.close();
