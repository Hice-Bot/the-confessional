var http = require('http');

var SESSION_2001 = '3046c7ef-9d6d-4a12-8022-a426fe3dd0cd';
var SESSION_2000 = 'dcd90413-5be1-4ffa-8301-8514aee4c80e';

function makeRequest(method, path, headers, body) {
  return new Promise(function(resolve, reject) {
    var options = {
      hostname: 'localhost',
      port: 3003,
      path: path,
      method: method,
      headers: headers
    };
    var req = http.request(options, function(res) {
      var data = '';
      res.on('data', function(chunk) { data += chunk; });
      res.on('end', function() {
        resolve({ status: res.statusCode, body: data });
      });
    });
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

async function runTests() {
  var text2001 = 'A'.repeat(2001);
  var text2000 = 'B'.repeat(2000);

  console.log('Text 2001 length:', text2001.length);
  console.log('Text 2000 length:', text2000.length);

  console.log('\n--- Test 1: 2001 characters should return 400 ---');
  var resp1 = await makeRequest('POST', '/confessional/submit', {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer agt_test_key_001',
    'X-Session-ID': SESSION_2001
  }, JSON.stringify({ text: text2001 }));
  console.log('Status:', resp1.status, '(expected 400)');
  console.log('Body:', resp1.body);

  console.log('\n--- Test 2: 2000 characters should return 200 ---');
  var resp2 = await makeRequest('POST', '/confessional/submit', {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer agt_test_key_001',
    'X-Session-ID': SESSION_2000
  }, JSON.stringify({ text: text2000 }));
  console.log('Status:', resp2.status, '(expected 200)');
  console.log('Body:', resp2.body);

  console.log('\n=== RESULTS ===');
  console.log('2001 chars -> 400:', resp1.status === 400 ? 'PASS' : 'FAIL');
  console.log('Error mentions length:', resp1.body.toLowerCase().includes('long') || resp1.body.toLowerCase().includes('length') || resp1.body.toLowerCase().includes('2000') ? 'PASS' : 'FAIL');
  console.log('2000 chars -> 200:', resp2.status === 200 ? 'PASS' : 'FAIL');
}

runTests().catch(console.error);
