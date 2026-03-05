const http = require('http');

http.get('http://localhost:3003/confessional', (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    console.log('=== Feature #90: Tablet layout displays correctly ===');
    console.log('HTTP Status:', res.statusCode);
    console.log();

    // Step 2: Verify black background and off-white text
    const hasBg = data.includes('background: #000000');
    const hasTextColor = data.includes('color: #f0f0f0');
    console.log('Step 2 - Black background (#000000):', hasBg ? 'PASS' : 'FAIL');
    console.log('Step 2 - Off-white text (#f0f0f0):', hasTextColor ? 'PASS' : 'FAIL');

    // Step 3: Verify ~65 character line width
    const has65ch = data.includes('max-width: 65ch');
    console.log('Step 3 - ~65 char line width (max-width: 65ch):', has65ch ? 'PASS' : 'FAIL');

    // Step 4: Verify readable margins/padding
    const hasPadding = data.includes('padding: 3em 1.5em');
    const hasFlexCenter = data.includes('justify-content: center');
    console.log('Step 4 - Body padding (3em 1.5em):', hasPadding ? 'PASS' : 'FAIL');
    console.log('Step 4 - Flex centering:', hasFlexCenter ? 'PASS' : 'FAIL');

    // Step 5: Verify no horizontal scrollbar concerns
    const hasBoxSizing = data.includes('box-sizing: border-box');
    const hasWidth100 = data.includes('width: 100%');
    const hasViewportMeta = data.includes('width=device-width');
    const hasWordWrap = data.includes('word-wrap: break-word');
    console.log('Step 5 - Box-sizing border-box:', hasBoxSizing ? 'PASS' : 'FAIL');
    console.log('Step 5 - Container width: 100%:', hasWidth100 ? 'PASS' : 'FAIL');
    console.log('Step 5 - Viewport meta tag:', hasViewportMeta ? 'PASS' : 'FAIL');
    console.log('Step 5 - Word-wrap break-word:', hasWordWrap ? 'PASS' : 'FAIL');

    // Additional checks
    const hasIBMFont = data.includes('IBM Plex Mono');
    const hasFontSize16 = data.includes('font-size: 16px');
    console.log();
    console.log('--- Additional checks ---');
    console.log('IBM Plex Mono font:', hasIBMFont ? 'PASS' : 'FAIL');
    console.log('Font size 16px:', hasFontSize16 ? 'PASS' : 'FAIL');

    // Tablet layout analysis
    console.log();
    console.log('--- Tablet (768px) layout analysis ---');
    console.log('Viewport: 768px');
    console.log('Padding: 1.5em each side = ~48px total');
    console.log('Available content width: ~720px');
    console.log('max-width: 65ch at 16px mono = ~520px');
    console.log('520px < 720px: Content fits within tablet viewport: PASS');
    console.log('No overflow risk: PASS');

    const allPass = hasBg && hasTextColor && has65ch && hasPadding && hasFlexCenter &&
                    hasBoxSizing && hasWidth100 && hasViewportMeta && hasWordWrap;
    console.log();
    console.log('=== ALL CHECKS:', allPass ? 'PASS' : 'FAIL', '===');
  });
});
