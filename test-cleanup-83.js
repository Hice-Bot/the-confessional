const Database = require('better-sqlite3');
const db = new Database('./confessional.db');

// Clean up the test confession and session
const del1 = db.prepare("DELETE FROM confessions WHERE text LIKE 'FEATURE83%'").run();
console.log('Deleted confessions:', del1.changes);

const del2 = db.prepare("DELETE FROM sessions WHERE agent_id = 'f83-test-agent'").run();
console.log('Deleted sessions:', del2.changes);

const del3 = db.prepare("DELETE FROM admin_actions WHERE confession_id = '40b2a666-4551-4ef3-8032-4bf2f5ffbedd'").run();
console.log('Deleted admin_actions:', del3.changes);

// Also clean up session_attempts for the test session hash
const crypto = require('crypto');
const hash = crypto.createHash('sha256').update('0b3101da-76fe-4ee8-a2a5-f47ef31204a8').digest('hex');
const del4 = db.prepare("DELETE FROM session_attempts WHERE session_hash = ?").run(hash);
console.log('Deleted session_attempts:', del4.changes);

db.close();
console.log('Cleanup done');
