const fs = require('fs');
const html = fs.readFileSync('src/public/confessional.html', 'utf8');

console.log('=== Feature #97: Semantic HTML Structure Verification ===\n');

// Step 1: Verify proper <html> root with lang attribute
const hasHtmlWithLang = /<html\s+lang="en">/.test(html);
console.log('Step 1: <html lang="en"> root element');
console.log('  Result:', hasHtmlWithLang ? 'PASS' : 'FAIL');
const htmlTag = html.match(/<html[^>]*>/);
console.log('  Found:', htmlTag ? htmlTag[0] : 'NOT FOUND');

// Step 2: Verify <body> element exists
const hasBody = /<body>/.test(html);
console.log('\nStep 2: <body> element exists');
console.log('  Result:', hasBody ? 'PASS' : 'FAIL');

// Step 3: Verify confessions use semantic elements
const usesArticle = /document\.createElement\('article'\)/.test(html);
const usesP = /document\.createElement\('p'\)/.test(html);
const usesMain = /<main\s+id="confessions-container">/.test(html);
const usesSection = /document\.createElement\('section'\)/.test(html);
console.log('\nStep 3: Confessions use semantic elements');
console.log('  Container is <main>:', usesMain ? 'PASS' : 'FAIL');
console.log('  Each confession uses <article>:', usesArticle ? 'PASS' : 'FAIL');
console.log('  Text content in <p>:', usesP ? 'PASS' : 'FAIL');
console.log('  Empty state uses <section>:', usesSection ? 'PASS' : 'FAIL');

// Step 4: No empty divs or non-semantic wrappers where semantic elements would be appropriate
const divElements = html.match(/<div[^>]*>/g) || [];
console.log('\nStep 4: No non-semantic wrappers where semantic elements appropriate');
console.log('  Remaining <div> elements:', divElements.length);
divElements.forEach(function(d) { console.log('    -', d); });

// Only remaining div should be sentinel (utility element, no content significance)
const sentinelDiv = /<div\s+id="sentinel">/.test(html);
console.log('  sentinel is a utility <div> (acceptable - no content significance):', sentinelDiv ? 'YES' : 'NO');

// Check no divs are created in JS for confessions
const jsDivCreate = html.match(/createElement\('div'\)/g) || [];
console.log('  JS createElement("div") calls:', jsDivCreate.length, '(should be 0)');

// Verify NO non-semantic div used where semantic would be appropriate
const nonSemanticIssues = [];
if (/<div\s+id="confessions-container">/.test(html)) {
  nonSemanticIssues.push('confessions-container should be <main>');
}
if (/createElement\('div'\)/.test(html)) {
  nonSemanticIssues.push('JS creates <div> elements where semantic elements should be used');
}

if (nonSemanticIssues.length > 0) {
  console.log('\n  NON-SEMANTIC ISSUES:');
  nonSemanticIssues.forEach(function(i) { console.log('    -', i); });
} else {
  console.log('\n  No non-semantic wrapper issues found.');
}

// Summary
console.log('\n=== Page Structure ===');
console.log('  <html lang="en">');
console.log('    <head>...</head>');
console.log('    <body>');
console.log('      <main id="confessions-container">');
console.log('        <article class="confession"> (per confession)');
console.log('          <p>confession text</p>');
console.log('        </article>');
console.log('        OR <section class="empty-state"> (if empty)');
console.log('      </main>');
console.log('      <div id="sentinel"> (utility: IntersectionObserver target)');
console.log('    </body>');
console.log('  </html>');

const allPass = hasHtmlWithLang && hasBody && usesArticle && usesP && usesMain && jsDivCreate.length === 0;
console.log('\n=== Overall:', allPass ? 'ALL CHECKS PASS' : 'SOME CHECKS FAILED', '===');
process.exit(allPass ? 0 : 1);
