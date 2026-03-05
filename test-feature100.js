var http = require('http');
var crypto = require('crypto');
var path = require('path');

function request(method, urlPath, headers, body) {
  return new Promise(function(resolve, reject) {
    var opts = { hostname: 'localhost', port: 3003, path: urlPath, method: method, headers: headers || {} };
    var req = http.request(opts, function(res) {
      var data = '';
      res.on('data', function(d) { data += d; });
      res.on('end', function() { resolve({ status: res.statusCode, body: data }); });
    });
    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

async function main() {
  var beforeTime = new Date();

  // Step 1: Create session
  var agentId = crypto.randomUUID();
  var sessResp = await request('POST', '/confessional/sessions',
    { 'Content-Type': 'application/json', 'Authorization': 'Bearer adm_test_key_001' },
    { agent_id: agentId });
  var sessData = JSON.parse(sessResp.body);
  console.log('Session created:', sessData.session_id);

  // Step 2: Submit confession with unique text (use alpha-only random to avoid PII scrubber)
  var chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
  var rand = '';
  for (var r = 0; r < 8; r++) rand += chars.charAt(Math.floor(Math.random() * chars.length));
  var uniqueText = 'CreatedAtTestFeatureHundred ' + rand;
  var submitResp = await request('POST', '/confessional/submit',
    { 'Content-Type': 'application/json', 'Authorization': 'Bearer agt_test_key_001', 'X-Session-ID': sessData.session_id },
    { text: uniqueText });
  console.log('Submit response:', submitResp.body, 'Status:', submitResp.status);
  console.log('Unique text:', uniqueText);

  var afterTime = new Date();

  // Step 3: Query database directly
  var Database = require('better-sqlite3');
  var dbPath = path.join(__dirname, 'confessional.db');
  var db = new Database(dbPath, { readonly: true });

  // Search by LIKE pattern in case of minor scrubbing
  var row = db.prepare("SELECT id, text, created_at, session_hash, flagged FROM confessions WHERE text LIKE ?").get('%CreatedAtTestFeatureHundred%');
  db.close();

  if (!row) {
    console.log('FAIL: Confession not found in database');
    return;
  }

  console.log('\n=== Database Query Results ===');
  console.log('ID:', row.id);
  console.log('Text:', row.text);
  console.log('created_at:', row.created_at);
  console.log('session_hash:', row.session_hash ? 'present (SHA-256)' : 'MISSING');
  console.log('flagged:', row.flagged);

  // Step 4: Verify created_at is NOT NULL
  console.log('\n=== Verification ===');
  var notNull = row.created_at !== null && row.created_at !== undefined && row.created_at !== '';
  console.log('created_at NOT NULL:', notNull);

  // Step 5: Verify created_at is valid ISO8601
  var iso8601Pattern = /^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2}/;
  var isIso = iso8601Pattern.test(row.created_at);
  console.log('created_at matches ISO8601:', isIso);

  // Step 6: Verify created_at is parseable
  var parsed = new Date(row.created_at);
  var isParseable = !isNaN(parsed.getTime());
  console.log('created_at parseable:', isParseable);

  // Step 7: Verify created_at is approximately 'now' (within last minute)
  if (isParseable) {
    // The DB timestamp might be UTC, adjust comparison
    var diffMs = Math.abs(afterTime.getTime() - parsed.getTime());
    // Also check if it's offset by timezone (SQLite datetime('now') is UTC)
    var diffMsFromBefore = Math.abs(beforeTime.getTime() - parsed.getTime());
    var withinMinute = diffMs < 60000 || diffMsFromBefore < 60000;

    // If timezone offset, the parsed time from SQLite (which stores UTC without Z) may be off
    // Let's also try treating the timestamp as UTC explicitly
    var utcStr = row.created_at.replace(' ', 'T') + 'Z';
    var parsedUtc = new Date(utcStr);
    var diffMsUtc = Math.abs(afterTime.getTime() - parsedUtc.getTime());
    var withinMinuteUtc = diffMsUtc < 60000;

    console.log('Time difference (local parse):', diffMs, 'ms');
    console.log('Time difference (UTC parse):', diffMsUtc, 'ms');
    console.log('Within 1 minute (either parse):', withinMinute || withinMinuteUtc);
  }

  // Cleanup: delete test confession
  var deleteResp = await request('DELETE', '/confessional/admin/confessions/' + row.id,
    { 'Content-Type': 'application/json', 'Authorization': 'Bearer adm_test_key_001' },
    { note: 'Test cleanup for feature 100' });
  console.log('\nCleanup: deleted test confession, status:', deleteResp.status);

  // Close session
  await request('POST', '/confessional/sessions/' + sessData.session_id + '/close',
    { 'Content-Type': 'application/json', 'Authorization': 'Bearer adm_test_key_001' });
  console.log('Session closed');

  console.log('\n=== Feature #100 Result ===');
  var allPass = notNull && isIso && isParseable;
  console.log(allPass ? 'PASS: created_at is automatically populated with valid ISO8601 timestamp' : 'FAIL: created_at verification failed');
}

main().catch(console.error);
