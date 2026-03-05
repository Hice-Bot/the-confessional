const http = require('http');
const crypto = require('crypto');

const BASE = 'http://localhost:3003';
const AGT_KEY = 'agt_test_key_001';
const ADM_KEY = 'adm_test_key_001';

function request(method, path, body, headers) {
  headers = headers || {};
  return new Promise(function(resolve, reject) {
    var url = new URL(path, BASE);
    var opts = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      method: method,
      headers: Object.assign({ 'Content-Type': 'application/json' }, headers)
    };
    var req = http.request(opts, function(res) {
      var data = '';
      res.on('data', function(c) { data += c; });
      res.on('end', function() {
        try { resolve({ status: res.statusCode, body: JSON.parse(data) }); }
        catch(e) { resolve({ status: res.statusCode, body: data }); }
      });
    });
    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

function createAndSubmitConfession(text) {
  var agentId = crypto.randomUUID();
  return request('POST', '/confessional/sessions', { agent_id: agentId }, {
    'Authorization': 'Bearer ' + ADM_KEY
  }).then(function(sessRes) {
    if (sessRes.status !== 200) throw new Error('Session create failed: ' + sessRes.status);
    var sessionId = sessRes.body.session_id;
    return request('POST', '/confessional/submit', { text: text }, {
      'Authorization': 'Bearer ' + AGT_KEY,
      'X-Session-ID': sessionId
    }).then(function(subRes) {
      if (subRes.status !== 200) throw new Error('Submit failed: ' + subRes.status);
      return sessionId;
    });
  });
}

function getConfessionIdByPrefix(prefix) {
  var Database = require('better-sqlite3');
  var db = new Database('./confessional.db', { readonly: true });
  var row = db.prepare("SELECT id FROM confessions WHERE text LIKE ? AND flagged = 0 LIMIT 1").get(prefix + '%');
  db.close();
  return row ? row.id : null;
}

function getAllConfessionIdsByPrefix(prefix) {
  var Database = require('better-sqlite3');
  var db = new Database('./confessional.db', { readonly: true });
  var rows = db.prepare("SELECT id FROM confessions WHERE text LIKE ?").all(prefix + '%');
  db.close();
  return rows.map(function(r) { return r.id; });
}

async function run() {
  console.log('=== Feature #49: Count endpoint matches feed total ===\n');

  // Step 1: Create several confessions
  console.log('Step 1: Creating 3 confessions...');
  var ts = Date.now();
  var confTexts = [
    'F49_TEST_A_' + ts,
    'F49_TEST_B_' + ts,
    'F49_TEST_C_' + ts
  ];
  for (var i = 0; i < confTexts.length; i++) {
    await createAndSubmitConfession(confTexts[i]);
    console.log('  Created: ' + confTexts[i]);
  }

  // Step 2: GET /confessional/count
  console.log('\nStep 2: GET /confessional/count...');
  var countRes = await request('GET', '/confessional/count');
  console.log('  Status: ' + countRes.status);
  console.log('  Count: ' + countRes.body.count);
  var countValue = countRes.body.count;

  // Step 3: GET /confessional/feed → get total
  console.log('\nStep 3: GET /confessional/feed...');
  var feedRes = await request('GET', '/confessional/feed');
  console.log('  Status: ' + feedRes.status);
  console.log('  Total: ' + feedRes.body.total);
  var feedTotal = feedRes.body.total;

  // Step 4: Verify count matches total
  console.log('\nStep 4: Verify count matches total...');
  if (countValue === feedTotal) {
    console.log('  PASS: count (' + countValue + ') === feed total (' + feedTotal + ')');
  } else {
    console.log('  FAIL: count (' + countValue + ') !== feed total (' + feedTotal + ')');
    process.exit(1);
  }

  // Step 5: Flag one confession
  console.log('\nStep 5: Flagging one confession...');
  var confId = getConfessionIdByPrefix('F49_TEST_A_');
  console.log('  Found confession ID: ' + confId);
  var flagRes = await request('POST', '/confessional/admin/flag', { id: confId }, {
    'Authorization': 'Bearer ' + ADM_KEY
  });
  console.log('  Flag result: ' + flagRes.status + ' ' + JSON.stringify(flagRes.body));

  // Step 6: Verify count decreased
  console.log('\nStep 6: GET /confessional/count after flagging...');
  var countRes2 = await request('GET', '/confessional/count');
  console.log('  Count before: ' + countValue);
  console.log('  Count after:  ' + countRes2.body.count);
  if (countRes2.body.count === countValue - 1) {
    console.log('  PASS: count decreased by 1');
  } else {
    console.log('  FAIL: count didnt decrease by 1 (expected ' + (countValue - 1) + ', got ' + countRes2.body.count + ')');
    process.exit(1);
  }

  // Step 7: Verify feed total also decreased
  console.log('\nStep 7: GET /confessional/feed after flagging...');
  var feedRes2 = await request('GET', '/confessional/feed');
  console.log('  Feed total before: ' + feedTotal);
  console.log('  Feed total after:  ' + feedRes2.body.total);
  if (feedRes2.body.total === feedTotal - 1) {
    console.log('  PASS: feed total decreased by 1');
  } else {
    console.log('  FAIL: feed total didnt decrease by 1 (expected ' + (feedTotal - 1) + ', got ' + feedRes2.body.total + ')');
    process.exit(1);
  }

  // Verify count still matches total after flag
  if (countRes2.body.count === feedRes2.body.total) {
    console.log('\n  PASS: count (' + countRes2.body.count + ') still matches feed total (' + feedRes2.body.total + ') after flagging');
  } else {
    console.log('\n  FAIL: count (' + countRes2.body.count + ') !== feed total (' + feedRes2.body.total + ') after flagging');
    process.exit(1);
  }

  // Cleanup
  console.log('\n--- Cleanup ---');
  await request('POST', '/confessional/admin/unflag', { id: confId }, {
    'Authorization': 'Bearer ' + ADM_KEY
  });

  var allIds = getAllConfessionIdsByPrefix('F49_TEST_');
  for (var j = 0; j < allIds.length; j++) {
    await request('DELETE', '/confessional/admin/confessions/' + allIds[j], {}, {
      'Authorization': 'Bearer ' + ADM_KEY
    });
    console.log('  Deleted test confession: ' + allIds[j]);
  }

  console.log('\n=== ALL 7 STEPS PASSED ===');
}

run().catch(function(err) {
  console.error('ERROR:', err);
  process.exit(1);
});
