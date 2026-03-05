var http = require('http');
var crypto = require('crypto');

var BASE = 'http://localhost:3003';
var AGT_KEY = 'agt_test_key_001';
var ADM_KEY = 'adm_test_key_001';

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

function sleep(ms) {
  return new Promise(function(resolve) { setTimeout(resolve, ms); });
}

function randomWord() {
  var words = ['WALRUS', 'FALCON', 'ORCHID', 'VELVET', 'ZEPHYR', 'QUARTZ', 'MANGO', 'LUNAR', 'COBALT', 'AMBER'];
  return words[Math.floor(Math.random() * words.length)];
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

async function run() {
  console.log('=== Feature #50: Feed confession order is newest-first ===\n');

  // Use alphabetic unique markers to avoid PII scrubbing of numbers
  var markerA = 'FIFTYA-' + randomWord() + '-' + randomWord() + '-OLDER';
  var markerB = 'FIFTYB-' + randomWord() + '-' + randomWord() + '-NEWER';
  var textA = markerA;
  var textB = markerB;

  // Step 1: Create session 1, submit confession A
  console.log('Step 1: Create session 1, submit confession A...');
  await createAndSubmitConfession(textA);
  console.log('  Submitted: ' + textA);

  // Step 2: Wait 1 second
  console.log('\nStep 2: Waiting 1.5 seconds...');
  await sleep(1500);
  console.log('  Done waiting');

  // Step 3: Create session 2, submit confession B
  console.log('\nStep 3: Create session 2, submit confession B...');
  await createAndSubmitConfession(textB);
  console.log('  Submitted: ' + textB);

  // Step 4: GET /confessional/feed → verify B appears before A
  console.log('\nStep 4: GET /confessional/feed - verify B before A...');
  var feedRes = await request('GET', '/confessional/feed?limit=100');
  var humanConfessions = feedRes.body.confessions;
  var indexA = -1;
  var indexB = -1;
  for (var i = 0; i < humanConfessions.length; i++) {
    if (humanConfessions[i].text === textA) indexA = i;
    if (humanConfessions[i].text === textB) indexB = i;
  }
  console.log('  Index of B (newer): ' + indexB);
  console.log('  Index of A (older): ' + indexA);
  if (indexB >= 0 && indexA >= 0 && indexB < indexA) {
    console.log('  PASS: B appears before A in human feed (newest-first)');
  } else {
    console.log('  FAIL: B (index ' + indexB + ') should be before A (index ' + indexA + ')');
    if (indexA === -1) console.log('    Could not find confession A in feed');
    if (indexB === -1) console.log('    Could not find confession B in feed');
    process.exit(1);
  }

  // Step 5: GET /confessional/feed/agent → verify B appears before A
  console.log('\nStep 5: GET /confessional/feed/agent - verify B before A...');
  var agentFeedRes = await request('GET', '/confessional/feed/agent?limit=100', null, {
    'Authorization': 'Bearer ' + AGT_KEY
  });
  var agentConfessions = agentFeedRes.body.confessions;
  var agentIndexA = -1;
  var agentIndexB = -1;
  var confA_created = null;
  var confB_created = null;
  for (var j = 0; j < agentConfessions.length; j++) {
    if (agentConfessions[j].text === textA) {
      agentIndexA = j;
      confA_created = agentConfessions[j].created_at;
    }
    if (agentConfessions[j].text === textB) {
      agentIndexB = j;
      confB_created = agentConfessions[j].created_at;
    }
  }
  console.log('  Index of B (newer): ' + agentIndexB + ' (created_at: ' + confB_created + ')');
  console.log('  Index of A (older): ' + agentIndexA + ' (created_at: ' + confA_created + ')');
  if (agentIndexB >= 0 && agentIndexA >= 0 && agentIndexB < agentIndexA) {
    console.log('  PASS: B appears before A in agent feed (newest-first)');
  } else {
    console.log('  FAIL: B (index ' + agentIndexB + ') should be before A (index ' + agentIndexA + ')');
    process.exit(1);
  }

  // Step 6: Verify agent feed created_at timestamps are in descending order
  console.log('\nStep 6: Verify agent feed timestamps in descending order...');
  var allDescending = true;
  var violationAt = -1;
  for (var k = 1; k < agentConfessions.length; k++) {
    var prev = agentConfessions[k - 1].created_at;
    var curr = agentConfessions[k].created_at;
    if (prev < curr) {
      allDescending = false;
      violationAt = k;
      console.log('  Violation at index ' + k + ': "' + prev + '" < "' + curr + '"');
      break;
    }
  }
  if (allDescending) {
    console.log('  PASS: All ' + agentConfessions.length + ' timestamps are in descending (newest-first) order');
  } else {
    console.log('  FAIL: Timestamps not in descending order at index ' + violationAt);
    process.exit(1);
  }

  // Verify B's timestamp >= A's timestamp
  if (confB_created >= confA_created) {
    console.log('  PASS: B created_at (' + confB_created + ') >= A created_at (' + confA_created + ')');
  } else {
    console.log('  FAIL: B created_at (' + confB_created + ') < A created_at (' + confA_created + ')');
    process.exit(1);
  }

  // Cleanup
  console.log('\n--- Cleanup ---');
  var Database = require('better-sqlite3');
  var db = new Database('./confessional.db');
  var rows = db.prepare("SELECT id FROM confessions WHERE text LIKE 'FIFTYA-%' OR text LIKE 'FIFTYB-%'").all();
  for (var m = 0; m < rows.length; m++) {
    db.prepare("DELETE FROM confessions WHERE id = ?").run(rows[m].id);
    console.log('  Deleted: ' + rows[m].id);
  }
  console.log('  Cleaned up ' + rows.length + ' test confessions');
  db.close();

  console.log('\n=== ALL 6 STEPS PASSED ===');
}

run().catch(function(err) {
  console.error('ERROR:', err);
  process.exit(1);
});
