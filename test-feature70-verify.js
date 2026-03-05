const { execSync } = require('child_process');

const BASE = 'http://localhost:3003';

// Step 1: Check we have 25+ confessions
const countResp = JSON.parse(execSync(`curl -s ${BASE}/confessional/count`).toString());
console.log('Step 1: Total confessions:', countResp.count, '(need 25+):', countResp.count >= 25);

// Step 2: GET /confessional/feed with no limit parameter
const feedResp = JSON.parse(execSync(`curl -s ${BASE}/confessional/feed`).toString());

// Step 3: Verify at most 20 confessions returned
console.log('Step 2+3: Feed without limit - confessions returned:', feedResp.confessions.length);
console.log('  At most 20:', feedResp.confessions.length <= 20);
console.log('  Exactly 20:', feedResp.confessions.length === 20);

// Step 4: Verify count field reflects returned count (max 20)
console.log('Step 4: count field:', feedResp.count, '- matches length:', feedResp.count === feedResp.confessions.length);

// Step 5: Verify next_cursor is non-null (more confessions exist)
console.log('Step 5: next_cursor is non-null:', feedResp.next_cursor !== null);
console.log('  next_cursor value:', feedResp.next_cursor ? feedResp.next_cursor.substring(0, 30) + '...' : null);

// Extra: verify total still reflects all unflagged
console.log('Extra: total field:', feedResp.total, '- matches count endpoint:', feedResp.total === countResp.count);

const allPass = countResp.count >= 25
  && feedResp.confessions.length === 20
  && feedResp.count === feedResp.confessions.length
  && feedResp.next_cursor !== null;

console.log('\n=== ALL STEPS PASS:', allPass, '===');
