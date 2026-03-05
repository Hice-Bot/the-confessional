const crypto = require('crypto');
const db = require('better-sqlite3')('./confessional.db');

const sessionId = '4c93adb1-d464-4e92-9df2-ae2a0a61628f';
const hash = crypto.createHash('sha256').update(sessionId).digest('hex');

db.prepare('DELETE FROM session_attempts WHERE session_hash = ?').run(hash);
db.prepare('DELETE FROM sessions WHERE id = ?').run(sessionId);

console.log('Cleaned up session and attempt for feature 61 test');
db.close();
