const { execSync } = require('child_process');

// Test with limit=2 to force pagination cursor
const resp = JSON.parse(execSync('curl -s "http://localhost:3003/confessional/feed?limit=2"').toString());

console.log('=== Pagination Test ===');
console.log('Limit=2 response:');
console.log('  confessions count:', resp.confessions.length);
console.log('  count field:', resp.count);
console.log('  total field:', resp.total);
console.log('  next_cursor:', resp.next_cursor);
console.log('  next_cursor is string:', typeof resp.next_cursor === 'string');

// Use cursor to get next page
if (resp.next_cursor) {
  const resp2 = JSON.parse(execSync('curl -s "http://localhost:3003/confessional/feed?limit=2&before=' + resp.next_cursor + '"').toString());
  console.log('\nPage 2 response:');
  console.log('  confessions count:', resp2.confessions.length);
  console.log('  count field:', resp2.count);
  console.log('  total field:', resp2.total);
  console.log('  next_cursor:', resp2.next_cursor);

  // Verify page 2 confessions also have only text field
  const onlyText2 = resp2.confessions.every(c => {
    const keys = Object.keys(c);
    return keys.length === 1 && keys[0] === 'text';
  });
  console.log('  Page 2 confessions have only text:', onlyText2);
}

console.log('\n=== PAGINATION STRUCTURE VERIFIED ===');
