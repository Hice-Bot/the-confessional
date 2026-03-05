var crypto = require('crypto');
var db = require('better-sqlite3')('./confessional.db');
var sessionHash = crypto.createHash('sha256').update('0ec0d18b-4251-4b61-9ea7-8b7cfbf51ab9').digest('hex');
var attempt = db.prepare("SELECT * FROM session_attempts WHERE session_hash = ?").get(sessionHash);
console.log('Session attempt recorded:', JSON.stringify(attempt));
var confession = db.prepare("SELECT * FROM confessions WHERE session_hash = ?").get(sessionHash);
console.log('Confession stored:', confession ? 'YES (BUG!)' : 'NO (correct)');
db.close();
