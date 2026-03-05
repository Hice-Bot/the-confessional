const { execSync } = require('child_process');

const BASE = 'http://localhost:3003';

// Step 1: Verify 100+ confessions exist
const countResp = JSON.parse(execSync(`curl -s ${BASE}/confessional/count`).toString());
console.log('Step 1: Total confessions:', countResp.count, '(need 100+):', countResp.count >= 100);

// Step 2+3: GET /confessional/feed - verify 200 and measure response time
const startTime = Date.now();
const feedRaw = execSync(`curl -s -w "\\n%{http_code}" ${BASE}/confessional/feed`).toString();
const endTime = Date.now();
const responseTime = endTime - startTime;

const lines = feedRaw.trim().split('\n');
const httpCode = lines[lines.length - 1];
const feedJson = lines.slice(0, -1).join('\n');

console.log('Step 2: HTTP status code:', httpCode, '- is 200:', httpCode === '200');
console.log('Step 3: Response time:', responseTime, 'ms - under 5000ms:', responseTime < 5000);

// Step 4: Verify valid JSON with confessions array
let feedResp;
try {
  feedResp = JSON.parse(feedJson);
  console.log('Step 4: Valid JSON: true');
  console.log('  Has confessions array:', Array.isArray(feedResp.confessions));
  console.log('  Has count:', typeof feedResp.count === 'number');
  console.log('  Has total:', typeof feedResp.total === 'number');
  console.log('  Has next_cursor:', feedResp.next_cursor !== undefined);
} catch (e) {
  console.log('Step 4: Valid JSON: false -', e.message);
}

// Step 5: Verify default limit of 20
console.log('Step 5: Confessions returned:', feedResp.confessions.length, '- default limit 20 applied:', feedResp.confessions.length === 20);

const allPass = countResp.count >= 100
  && httpCode === '200'
  && responseTime < 5000
  && Array.isArray(feedResp.confessions)
  && feedResp.confessions.length === 20;

console.log('\n=== ALL STEPS PASS:', allPass, '===');
