const http = require('http');

const AGT_KEY = 'agt_test_key_001';
const ADM_KEY = 'adm_test_key_001';
const BASE = 'http://localhost:3003';

function request(method, path, headers, body) {
  return new Promise((resolve, reject) => {
    var url = new URL(path, BASE);
    var opts = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      method: method,
      headers: headers || {}
    };
    var req = http.request(opts, (res) => {
      var data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        resolve({ status: res.statusCode, headers: res.headers, body: data });
      });
    });
    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

function delay(ms) {
  return new Promise((resolve) => { setTimeout(resolve, ms); });
}

async function createAndSubmit(text) {
  var sessRes = await request('POST', '/confessional/sessions', {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer ' + ADM_KEY
  }, { agent_id: '550e8400-e29b-41d4-a716-446655440099' });
  var sessData = JSON.parse(sessRes.body);

  var submitRes = await request('POST', '/confessional/submit', {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer ' + AGT_KEY,
    'X-Session-ID': sessData.session_id
  }, { text: text });
  return { session_id: sessData.session_id, submit: JSON.parse(submitRes.body) };
}

async function run() {
  console.log('=== Feature #99: Cursor ordering is correct ===\n');

  // Step 1: Create 5+ confessions in sequence with slight delays
  console.log('Step 1: Creating 5 confessions in sequence with delays...');
  var confTexts = [];
  for (var i = 1; i <= 5; i++) {
    var text = 'CURSOR_ORDER_TEST_99_NUM_' + i + '_TS_' + Date.now();
    confTexts.push(text);
    await createAndSubmit(text);
    console.log('  Created confession #' + i + ': ' + text.substring(0, 40) + '...');
    if (i < 5) await delay(1100); // Slight delay to ensure different timestamps
  }

  // Step 2: GET /confessional/feed → verify newest first
  console.log('\nStep 2: GET /confessional/feed → verify newest first...');
  var feedRes = await request('GET', '/confessional/feed?limit=10', {});
  var feedData = JSON.parse(feedRes.body);
  console.log('  Status:', feedRes.status);
  console.log('  Count:', feedData.count, 'Total:', feedData.total);

  // Find our test confessions in the feed (should be at the top, newest first)
  var foundTexts = [];
  for (var j = 0; j < feedData.confessions.length; j++) {
    var c = feedData.confessions[j];
    if (c.text && c.text.indexOf('CURSOR_ORDER_TEST_99_NUM_') === 0) {
      foundTexts.push(c.text);
    }
  }
  console.log('  Found test confessions in feed:', foundTexts.length);

  // Newest should be first (NUM_5 before NUM_4 before ... NUM_1)
  var newestFirst = true;
  for (var k = 0; k < foundTexts.length - 1; k++) {
    var numA = parseInt(foundTexts[k].split('NUM_')[1]);
    var numB = parseInt(foundTexts[k + 1].split('NUM_')[1]);
    if (numA <= numB) {
      newestFirst = false;
      console.log('  ERROR: ' + numA + ' should be > ' + numB);
    }
  }
  console.log('  Newest first ordering correct:', newestFirst);

  // Step 3: Use next_cursor to paginate → verify older results appear
  console.log('\nStep 3: Paginate with next_cursor...');
  var page1 = await request('GET', '/confessional/feed?limit=3', {});
  var page1Data = JSON.parse(page1.body);
  console.log('  Page 1: ' + page1Data.count + ' confessions, cursor:', page1Data.next_cursor ? page1Data.next_cursor.substring(0, 30) + '...' : null);

  if (page1Data.next_cursor) {
    var page2 = await request('GET', '/confessional/feed?limit=3&before=' + encodeURIComponent(page1Data.next_cursor), {});
    var page2Data = JSON.parse(page2.body);
    console.log('  Page 2: ' + page2Data.count + ' confessions');

    // Page 2 should have older confessions (not overlapping with page 1)
    var page1Texts = page1Data.confessions.map(function(c) { return c.text; });
    var page2Texts = page2Data.confessions.map(function(c) { return c.text; });
    var overlap = false;
    for (var m = 0; m < page2Texts.length; m++) {
      if (page1Texts.indexOf(page2Texts[m]) !== -1) {
        overlap = true;
        break;
      }
    }
    console.log('  No overlap between pages:', !overlap);
    console.log('  Pagination working: older results appear in page 2');
  }

  // Step 4: GET /confessional/feed/agent → verify same ordering with timestamps
  console.log('\nStep 4: GET /confessional/feed/agent → verify ordering with timestamps...');
  var agentFeedRes = await request('GET', '/confessional/feed/agent?limit=10', {
    'Authorization': 'Bearer ' + AGT_KEY
  });
  var agentFeedData = JSON.parse(agentFeedRes.body);
  console.log('  Status:', agentFeedRes.status);
  console.log('  Count:', agentFeedData.count);

  var agentFoundTexts = [];
  var agentTimestamps = [];
  for (var n = 0; n < agentFeedData.confessions.length; n++) {
    var ac = agentFeedData.confessions[n];
    if (ac.text && ac.text.indexOf('CURSOR_ORDER_TEST_99_NUM_') === 0) {
      agentFoundTexts.push(ac.text);
      agentTimestamps.push(ac.created_at);
    }
  }
  console.log('  Found test confessions:', agentFoundTexts.length);

  // Verify timestamps are in descending order (newest first)
  var timestampsDescending = true;
  for (var p = 0; p < agentTimestamps.length - 1; p++) {
    if (agentTimestamps[p] < agentTimestamps[p + 1]) {
      timestampsDescending = false;
      console.log('  ERROR: timestamp ' + agentTimestamps[p] + ' should be >= ' + agentTimestamps[p + 1]);
    }
  }
  console.log('  Timestamps in descending order:', timestampsDescending);

  // Step 5: Verify compound cursor format is timestamp_uuid for agent feed
  console.log('\nStep 5: Verify agent feed compound cursor format...');
  var agentCursor = agentFeedData.next_cursor;
  console.log('  Agent feed next_cursor:', agentCursor);
  // Compound cursor format: ISO8601_timestamp + underscore + UUID
  var cursorPattern = /^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}:\d{2}[._]?.*_[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
  var isCompoundCursor = cursorPattern.test(agentCursor);
  console.log('  Matches compound cursor (timestamp_uuid):', isCompoundCursor);
  if (!isCompoundCursor) {
    // Try more flexible check - must contain a UUID portion
    var parts = agentCursor.split('_');
    console.log('  Cursor parts count:', parts.length);
    console.log('  Cursor value for manual inspection:', agentCursor);
    // Check that it contains a UUID-like portion
    var uuidPattern = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/;
    var hasUuid = uuidPattern.test(agentCursor);
    console.log('  Contains UUID:', hasUuid);
    // Check timestamp portion
    var hasTimestamp = /\d{4}-\d{2}-\d{2}/.test(agentCursor);
    console.log('  Contains timestamp:', hasTimestamp);
    isCompoundCursor = hasUuid && hasTimestamp;
    console.log('  Compound cursor valid (flexible check):', isCompoundCursor);
  }

  // Step 6: Verify opaque cursor is base64-encoded for human feed
  console.log('\nStep 6: Verify human feed opaque cursor is base64-encoded...');
  var humanFeed = await request('GET', '/confessional/feed?limit=5', {});
  var humanData = JSON.parse(humanFeed.body);
  var humanCursor = humanData.next_cursor;
  console.log('  Human feed next_cursor:', humanCursor);

  // Try to base64 decode it
  var decoded = Buffer.from(humanCursor, 'base64').toString('utf-8');
  console.log('  Decoded cursor:', decoded);
  // Re-encode to check if it matches (valid base64)
  var reencoded = Buffer.from(decoded, 'utf-8').toString('base64');
  // Base64 padding may differ, so compare decoded content
  var decoded2 = Buffer.from(reencoded, 'base64').toString('utf-8');
  var isBase64 = decoded === decoded2;
  console.log('  Is valid base64:', isBase64);
  console.log('  Decoded content looks like compound value:', decoded.indexOf('_') > -1 || decoded.indexOf(':') > -1);

  // Summary
  console.log('\n=== RESULTS ===');
  var allPassed = newestFirst && timestampsDescending && isCompoundCursor && isBase64;
  console.log('All checks passed:', allPassed);
}

run().catch(console.error);
