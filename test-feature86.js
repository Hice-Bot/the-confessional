const http = require('http');

const BASE = 'http://localhost:3003';
const AGT_KEY = 'agt_test_key_002';

function request(method, path, headers, body) {
  return new Promise((resolve, reject) => {
    var url = new URL(path, BASE);
    var opts = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname,
      method,
      headers: headers || {}
    };
    var req = http.request(opts, (res) => {
      var data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        var json = null;
        try { json = JSON.parse(data); } catch(e) {}
        resolve({ status: res.statusCode, body: data, json: json });
      });
    });
    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

async function main() {
  console.log('=== Feature #86: Rate limit error message is correct ===\n');

  // Step 1: Trigger rate limit on submit endpoint
  // Rate limit is 10 per minute per agent key
  // Use agt_test_key_002 to avoid interfering with other tests
  console.log('Step 1: Trigger rate limit on submit endpoint (sending 12 rapid requests)');

  var results = [];
  for (var i = 0; i < 12; i++) {
    var resp = await request('POST', '/confessional/submit', {
      'Authorization': 'Bearer ' + AGT_KEY,
      'Content-Type': 'application/json',
      'X-Session-ID': 'fake-session-' + i
    }, { text: 'rate limit test ' + i });
    results.push(resp);
    console.log('  Request ' + (i + 1) + ': HTTP ' + resp.status);
  }

  // Find the first 429 response
  var rateLimited = results.filter(function(r) { return r.status === 429; });
  var nonLimited = results.filter(function(r) { return r.status !== 429; });

  console.log('\n  Total requests: ' + results.length);
  console.log('  Non-rate-limited: ' + nonLimited.length);
  console.log('  Rate-limited (429): ' + rateLimited.length);
  console.log('  PASS:', rateLimited.length > 0);

  // Step 2: Verify response status is 429
  console.log('\nStep 2: Verify response status is 429');
  if (rateLimited.length > 0) {
    console.log('  First 429 response status:', rateLimited[0].status);
    console.log('  PASS:', rateLimited[0].status === 429);
  } else {
    console.log('  FAIL: No 429 responses received');
  }

  // Step 3: Verify response body contains error about rate limit
  console.log('\nStep 3: Verify response body contains error about rate limit');
  if (rateLimited.length > 0) {
    var rlResp = rateLimited[0];
    console.log('  Body:', rlResp.body);
    console.log('  Has JSON:', rlResp.json !== null);

    if (rlResp.json) {
      console.log('  Has error field:', typeof rlResp.json.error === 'string');
      console.log('  Error message:', rlResp.json.error);
      var correctMessage = rlResp.json.error === 'rate limit exceeded';
      console.log('  Message is "rate limit exceeded":', correctMessage);
      console.log('  PASS:', correctMessage);
    } else {
      console.log('  FAIL: Response is not valid JSON');
    }
  } else {
    console.log('  FAIL: No 429 responses to check');
  }

  var allPass = rateLimited.length > 0 &&
    rateLimited[0].status === 429 &&
    rateLimited[0].json !== null &&
    rateLimited[0].json.error === 'rate limit exceeded';
  console.log('\n=== ALL STEPS PASS:', allPass, '===');
}

main().catch(console.error);
