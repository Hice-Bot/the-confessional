var Database = require('better-sqlite3');
var db = new Database('/mnt/c/Users/turke/the-confessional/confessional.db', { readonly: true });
var recentActions = db.prepare('SELECT action, admin_key_prefix, LENGTH(admin_key_prefix) as len FROM admin_actions ORDER BY created_at DESC LIMIT 10').all();
console.log('Recent admin actions:');
recentActions.forEach(function(a) { console.log('  ' + a.action + ' prefix="' + a.admin_key_prefix + '" len=' + a.len); });
var badActions = db.prepare('SELECT * FROM admin_actions WHERE LENGTH(admin_key_prefix) != 8').all();
console.log('Actions with non-8-char prefix: ' + badActions.length);
db.close();
