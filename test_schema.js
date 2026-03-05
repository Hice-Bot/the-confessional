var db = require('better-sqlite3')('confessional.db');

// List all tables
var tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();
console.log('=== TABLES ===');
tables.forEach(function(t) { console.log(' -', t.name); });

// List all indexes
var indexes = db.prepare("SELECT name, tbl_name FROM sqlite_master WHERE type='index' AND name NOT LIKE 'sqlite_%'").all();
console.log('=== INDEXES ===');
indexes.forEach(function(i) { console.log(' -', i.name, 'on', i.tbl_name); });

// Check sessions schema
var sessionsInfo = db.prepare("PRAGMA table_info(sessions)").all();
console.log('\n=== SESSIONS SCHEMA ===');
sessionsInfo.forEach(function(c) { console.log('  ', c.name, c.type, c.pk ? 'PK' : '', c.notnull ? 'NOT NULL' : '', c.dflt_value ? 'DEFAULT ' + c.dflt_value : ''); });

// Check confessions schema
var confessionsInfo = db.prepare("PRAGMA table_info(confessions)").all();
console.log('\n=== CONFESSIONS SCHEMA ===');
confessionsInfo.forEach(function(c) { console.log('  ', c.name, c.type, c.pk ? 'PK' : '', c.notnull ? 'NOT NULL' : '', c.dflt_value ? 'DEFAULT ' + c.dflt_value : ''); });

// Check session_attempts schema
var attemptsInfo = db.prepare("PRAGMA table_info(session_attempts)").all();
console.log('\n=== SESSION_ATTEMPTS SCHEMA ===');
attemptsInfo.forEach(function(c) { console.log('  ', c.name, c.type, c.pk ? 'PK' : '', c.notnull ? 'NOT NULL' : '', c.dflt_value ? 'DEFAULT ' + c.dflt_value : ''); });

// Check admin_actions schema
var adminInfo = db.prepare("PRAGMA table_info(admin_actions)").all();
console.log('\n=== ADMIN_ACTIONS SCHEMA ===');
adminInfo.forEach(function(c) { console.log('  ', c.name, c.type, c.pk ? 'PK' : '', c.notnull ? 'NOT NULL' : '', c.dflt_value ? 'DEFAULT ' + c.dflt_value : ''); });

// Check index details
var indexList = db.prepare("SELECT name, sql FROM sqlite_master WHERE type='index' AND name NOT LIKE 'sqlite_%'").all();
console.log('\n=== INDEX DEFINITIONS ===');
indexList.forEach(function(i) { console.log(' ', i.name + ':', i.sql); });

db.close();
