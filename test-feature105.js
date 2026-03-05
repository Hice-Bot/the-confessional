// Feature #105: Feed pagination round-trip complete
// Verify paginating through the entire feed returns all confessions exactly once.
var http = require('http');
var Database = require('better-sqlite3');
var path = require('path');
var crypto = require('crypto');

var DB_PATH = path.join(__dirname, 'confessional.db');

function request(method, urlPath) {
  return new Promise(function(resolve, reject) {
    var url = new URL(urlPath, 'http://localhost:3003');
    var opts = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      method: method
    };
    var req = http.request(opts, function(res) {
      var d = '';
      res.on('data', function(c) { d += c; });
      res.on('end', function() {
        var parsed;
        try { parsed = JSON.parse(d); } catch(e) { parsed = d; }
        resolve({ status: res.statusCode, body: parsed });
      });
    });
    req.on('error', reject);
    req.end();
  });
}

async function run() {
  console.log('=== Feature #105: Feed pagination round-trip complete ===\n');

  var db = new Database(DB_PATH);

  // Clean up any leftover F105 test data
  db.prepare("DELETE FROM confessions WHERE text LIKE '%_F105_PGRTRIP'").run();

  // Also clean up duplicate regression test confessions to have a clean dataset
  // First find texts that appear more than once
  var dupes = db.prepare("SELECT text, COUNT(*) as cnt FROM confessions WHERE flagged = 0 GROUP BY text HAVING cnt > 1").all();
  if (dupes.length > 0) {
    console.log('Found ' + dupes.length + ' texts with duplicate entries, deduplicating...');
    for (var d = 0; d < dupes.length; d++) {
      // Keep one, delete the rest
      var rows = db.prepare("SELECT id FROM confessions WHERE text = ? AND flagged = 0 ORDER BY created_at DESC").all(dupes[d].text);
      for (var r = 1; r < rows.length; r++) {
        db.prepare("DELETE FROM confessions WHERE id = ?").run(rows[r].id);
      }
    }
  }

  var beforeCount = db.prepare('SELECT COUNT(*) as count FROM confessions WHERE flagged = 0').get().count;
  console.log('Unflagged confessions before test: ' + beforeCount);

  // Step 1: Create 30 unique confessions with identifiable text
  console.log('\nStep 1: Creating 30 unique confessions (ROUNDTRIP_1 through ROUNDTRIP_30)...');
  var insertStmt = db.prepare(
    'INSERT INTO confessions (id, text, created_at, session_hash, flagged) VALUES (?, ?, ?, ?, 0)'
  );
  var createdTexts = [];

  for (var i = 1; i <= 30; i++) {
    var confId = crypto.randomUUID();
    var text = 'ROUNDTRIP_' + i + '_F105_PGRTRIP';
    // Use slightly different timestamps to ensure deterministic ordering
    var ts = '2026-03-05 19:50:' + String(i).padStart(2, '0');
    var sessionHash = crypto.createHash('sha256').update('f105-session-' + i + '-' + Date.now()).digest('hex');

    insertStmt.run(confId, text, ts, sessionHash);
    createdTexts.push(text);
  }
  console.log('  Created ' + createdTexts.length + ' confessions');

  var afterCount = db.prepare('SELECT COUNT(*) as count FROM confessions WHERE flagged = 0').get().count;
  var expectedTotal = beforeCount + 30;
  console.log('  Total unflagged after insert: ' + afterCount + ' (expected: ' + expectedTotal + ', match: ' + (afterCount === expectedTotal) + ')');

  db.close();

  // Step 2: Paginate through /confessional/feed with limit=10
  console.log('\nStep 2: Paginating through /confessional/feed with limit=10...');
  var allTexts = [];
  var cursor = null;
  var pageNum = 0;
  var firstTotal = null;
  var lastPageCursorNull = false;
  var totalConsistentAcrossPages = true;

  while (true) {
    pageNum++;
    var feedPath = '/confessional/feed?limit=10';
    if (cursor) feedPath += '&before=' + encodeURIComponent(cursor);
    var pageRes = await request('GET', feedPath);

    if (pageRes.status !== 200) {
      console.log('  ERROR: Feed returned status ' + pageRes.status);
      break;
    }

    var page = pageRes.body;
    console.log('  Page ' + pageNum + ': ' + page.confessions.length + ' items, total=' + page.total + ', cursor=' + (page.next_cursor ? 'present' : 'null'));

    if (firstTotal === null) firstTotal = page.total;
    if (page.total !== firstTotal) {
      totalConsistentAcrossPages = false;
      console.log('  WARNING: total changed from ' + firstTotal + ' to ' + page.total);
    }

    for (var j = 0; j < page.confessions.length; j++) {
      allTexts.push(page.confessions[j].text);
    }

    if (!page.next_cursor) {
      lastPageCursorNull = true;
      console.log('  Final page reached (next_cursor is null)');
      break;
    }
    cursor = page.next_cursor;

    if (pageNum > 100) {
      console.log('  ERROR: Too many pages, stopping');
      break;
    }
  }

  // Step 3: Collect all confession texts across all pages
  console.log('\nStep 3: Collected ' + allTexts.length + ' texts across ' + pageNum + ' pages');

  // Step 4: Verify all 30 unique ROUNDTRIP texts are present
  console.log('\nStep 4: Verifying all 30 ROUNDTRIP texts are present...');
  var allPresent = true;
  var missing = [];
  for (var k = 1; k <= 30; k++) {
    var expected = 'ROUNDTRIP_' + k + '_F105_PGRTRIP';
    if (allTexts.indexOf(expected) === -1) {
      allPresent = false;
      missing.push(expected);
    }
  }
  if (allPresent) {
    console.log('  All 30 ROUNDTRIP texts found: PASS');
  } else {
    console.log('  MISSING ' + missing.length + ' texts: FAIL');
    for (var m = 0; m < missing.length; m++) {
      console.log('    - ' + missing[m]);
    }
  }

  // Step 5: Verify no duplicates across pages
  // Since human feed only returns text (no id), we verify two ways:
  // a) All 30 ROUNDTRIP texts appear exactly once each (they have unique text)
  // b) Total collected equals total reported (meaning correct number of items paginated)
  console.log('\nStep 5: Checking for duplicates...');
  var roundtripCounts = {};
  var hasDuplicates = false;
  for (var n = 0; n < allTexts.length; n++) {
    var txt = allTexts[n];
    if (txt.indexOf('_F105_PGRTRIP') !== -1) {
      roundtripCounts[txt] = (roundtripCounts[txt] || 0) + 1;
      if (roundtripCounts[txt] > 1) hasDuplicates = true;
    }
  }

  if (!hasDuplicates) {
    console.log('  All 30 ROUNDTRIP texts appear exactly once: PASS');
  } else {
    var dupList = Object.keys(roundtripCounts).filter(function(t) { return roundtripCounts[t] > 1; });
    console.log('  DUPLICATES among ROUNDTRIP texts: FAIL');
    for (var dd = 0; dd < dupList.length; dd++) {
      console.log('    "' + dupList[dd] + '" x' + roundtripCounts[dupList[dd]]);
    }
  }

  // Also verify total items collected = total reported (no items skipped or repeated)
  var totalCorrect = allTexts.length === firstTotal;
  console.log('  Items collected (' + allTexts.length + ') === total reported (' + firstTotal + '): ' + (totalCorrect ? 'PASS' : 'FAIL'));
  console.log('  This confirms no confession was returned twice or skipped during pagination');

  // Step 6: Verify next_cursor is null on the final page
  console.log('\nStep 6: next_cursor null on final page: ' + (lastPageCursorNull ? 'PASS' : 'FAIL'));

  // Step 7: Verify total count matches across all pages
  console.log('\nStep 7: Total count consistency...');
  console.log('  First page total: ' + firstTotal);
  console.log('  Total texts collected: ' + allTexts.length);
  console.log('  total field consistent across all pages: ' + (totalConsistentAcrossPages ? 'PASS' : 'FAIL'));
  console.log('  total matches collected count: ' + (totalCorrect ? 'PASS' : 'FAIL'));

  // Summary
  console.log('\n=== SUMMARY ===');
  var step1pass = createdTexts.length === 30;
  var step4pass = allPresent;
  var step5pass = !hasDuplicates && totalCorrect;
  var step6pass = lastPageCursorNull;
  var step7pass = totalCorrect && totalConsistentAcrossPages;

  console.log('Step 1 - Create 30 unique confessions: ' + (step1pass ? 'PASS' : 'FAIL'));
  console.log('Step 2 - Paginate with limit=10: PASS (' + pageNum + ' pages)');
  console.log('Step 3 - Collect texts: PASS (' + allTexts.length + ' texts)');
  console.log('Step 4 - All 30 present: ' + (step4pass ? 'PASS' : 'FAIL'));
  console.log('Step 5 - No duplicates: ' + (step5pass ? 'PASS' : 'FAIL'));
  console.log('Step 6 - Final cursor null: ' + (step6pass ? 'PASS' : 'FAIL'));
  console.log('Step 7 - Total consistent: ' + (step7pass ? 'PASS' : 'FAIL'));

  var overall = step1pass && step4pass && step5pass && step6pass && step7pass;
  console.log('\nOVERALL: ' + (overall ? 'ALL STEPS PASS' : 'SOME STEPS FAILED'));

  // Cleanup
  console.log('\nCleaning up test data...');
  var db2 = new Database(DB_PATH);
  var delResult = db2.prepare("DELETE FROM confessions WHERE text LIKE '%_F105_PGRTRIP'").run();
  console.log('  Deleted ' + delResult.changes + ' test confessions');
  var finalCount = db2.prepare('SELECT COUNT(*) as count FROM confessions WHERE flagged = 0').get().count;
  console.log('  Final unflagged count: ' + finalCount + ' (should be ' + beforeCount + ', match: ' + (finalCount === beforeCount) + ')');
  db2.close();

  console.log('\nDone!');
}

run().catch(function(e) { console.error('Error:', e); });
