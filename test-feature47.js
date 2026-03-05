const { execSync } = require('child_process');

const resp = JSON.parse(execSync('curl -s http://localhost:3003/confessional/feed').toString());

console.log('=== Feature 47 Verification ===');

// Step 1: GET /confessional/feed
console.log('Step 1: GET /confessional/feed - got response');

// Step 2: Has confessions array
console.log('Step 2: Has confessions array:', Array.isArray(resp.confessions));

// Step 3: Has count field (number)
console.log('Step 3: Has count field (number):', typeof resp.count === 'number', '- value:', resp.count);

// Step 4: Has total field (number)
console.log('Step 4: Has total field (number):', typeof resp.total === 'number', '- value:', resp.total);

// Step 5: Has next_cursor field (string or null)
console.log('Step 5: Has next_cursor field (string or null):', resp.next_cursor === null || typeof resp.next_cursor === 'string', '- value:', resp.next_cursor);

// Step 6: Each confession has ONLY text field
const onlyText = resp.confessions.every(c => {
  const keys = Object.keys(c);
  return keys.length === 1 && keys[0] === 'text';
});
console.log('Step 6: Each confession has ONLY text field:', onlyText);
if (resp.confessions.length > 0) {
  console.log('  Sample keys:', JSON.stringify(Object.keys(resp.confessions[0])));
}

// Step 7: Ordered newest-first
console.log('Step 7: Newest-first ordering:');
console.log('  First item:', resp.confessions[0].text.substring(0, 60));
console.log('  Second item:', resp.confessions[1].text.substring(0, 60));
console.log('  SECOND confession is first (newest):', resp.confessions[0].text.includes('SECOND'));

// Summary
const allPass = Array.isArray(resp.confessions)
  && typeof resp.count === 'number'
  && typeof resp.total === 'number'
  && (resp.next_cursor === null || typeof resp.next_cursor === 'string')
  && onlyText
  && resp.confessions[0].text.includes('SECOND');

console.log('\n=== ALL STEPS PASS:', allPass, '===');
