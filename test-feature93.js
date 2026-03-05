const http = require('http');

function fetch(url) {
  return new Promise((resolve, reject) => {
    http.get(url, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body: data }));
    }).on('error', reject);
  });
}

async function main() {
  // Step 1: Load /confessional and verify it has at least 3 confessions
  const htmlRes = await fetch('http://localhost:3003/confessional');
  process.stdout.write('Step 1: GET /confessional status: ' + htmlRes.status + '\n');
  process.stdout.write('Content-Type: ' + htmlRes.headers['content-type'] + '\n');

  const feedRes = await fetch('http://localhost:3003/confessional/feed?limit=5');
  const feed = JSON.parse(feedRes.body);
  process.stdout.write('Feed count: ' + feed.count + ', total: ' + feed.total + '\n');
  process.stdout.write('Has 3+ confessions: ' + (feed.total >= 3 ? 'YES' : 'NO') + '\n\n');

  // Step 2: Verify each confession has margin/padding creating 2-3em of space
  // Check the CSS in the HTML
  const hasConfessionClass = htmlRes.body.includes('.confession {') || htmlRes.body.includes('.confession{');
  process.stdout.write('Step 2: Has .confession CSS class: ' + hasConfessionClass + '\n');

  // Extract the margin-bottom value from .confession
  const confessionMatch = htmlRes.body.match(/\.confession\s*\{[^}]*margin-bottom:\s*([^;]+)/);
  if (confessionMatch) {
    process.stdout.write('margin-bottom value: ' + confessionMatch[1].trim() + '\n');
    const emValue = parseFloat(confessionMatch[1]);
    process.stdout.write('Parsed em value: ' + emValue + '\n');
    process.stdout.write('In 2-3em range: ' + (emValue >= 2 && emValue <= 3 ? 'YES' : 'NO') + '\n\n');
  } else {
    process.stdout.write('ERROR: No margin-bottom found on .confession\n\n');
  }

  // Step 3: Verify entries don't touch or overlap
  // Check for positive margin and no negative margins
  const hasNegativeMargin = htmlRes.body.includes('margin-bottom: -') || htmlRes.body.includes('margin-top: -');
  process.stdout.write('Step 3: Has negative margins: ' + hasNegativeMargin + '\n');

  // Check that .confession doesn't have overlapping styles (position: absolute, negative transform, etc.)
  const hasOverlapRisk = htmlRes.body.includes('position: absolute') && htmlRes.body.includes('.confession');
  process.stdout.write('Has overlap risk (absolute positioning): ' + hasOverlapRisk + '\n');

  // Verify the universal reset doesn't interfere
  const hasBoxSizing = htmlRes.body.includes('box-sizing: border-box');
  process.stdout.write('Has box-sizing: border-box: ' + hasBoxSizing + '\n');

  // The margin-bottom creates space between entries, preventing touching
  const marginBottom = confessionMatch ? confessionMatch[1].trim() : 'none';
  process.stdout.write('Entries cannot touch with margin-bottom: ' + marginBottom + '\n\n');

  // Step 4: Verify spacing is consistent between all confessions
  // All confessions use the same .confession class so they all get the same margin-bottom
  // Check that no per-confession overrides exist
  const confessionStyles = htmlRes.body.match(/\.confession[^{]*\{[^}]*\}/g);
  process.stdout.write('Step 4: Number of .confession CSS rules found: ' + (confessionStyles ? confessionStyles.length : 0) + '\n');
  if (confessionStyles) {
    confessionStyles.forEach((rule, i) => {
      process.stdout.write('  Rule ' + i + ': ' + rule.replace(/\s+/g, ' ').trim() + '\n');
    });
  }

  // Check that JS doesn't add inline margin styles
  const jsSection = htmlRes.body.substring(htmlRes.body.indexOf('<script>'));
  const hasInlineMargin = jsSection.includes('style.margin') || jsSection.includes('marginBottom');
  process.stdout.write('JS sets inline margins: ' + hasInlineMargin + '\n');

  // All confessions use class="confession" (from JS), so spacing is consistent
  const hasClassConfession = jsSection.includes("className = 'confession'") || jsSection.includes('className = "confession"');
  process.stdout.write('JS assigns confession class uniformly: ' + hasClassConfession + '\n');

  // Summary
  process.stdout.write('\n=== SUMMARY ===\n');
  process.stdout.write('Step 1 (3+ confessions): ' + (feed.total >= 3 ? 'PASS' : 'FAIL') + '\n');
  const emVal = confessionMatch ? parseFloat(confessionMatch[1]) : 0;
  process.stdout.write('Step 2 (2-3em spacing): ' + (emVal >= 2 && emVal <= 3 ? 'PASS' : 'FAIL') + ' (' + emVal + 'em)\n');
  process.stdout.write('Step 3 (no overlap): ' + (!hasNegativeMargin && !hasOverlapRisk ? 'PASS' : 'FAIL') + '\n');
  process.stdout.write('Step 4 (consistent spacing): ' + (hasClassConfession && !hasInlineMargin ? 'PASS' : 'FAIL') + '\n');
}

main().catch(err => { process.stderr.write(err.message + '\n'); process.exit(1); });
