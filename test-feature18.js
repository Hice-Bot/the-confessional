const { chromium } = require('playwright');

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.goto('http://localhost:3003/confessional');

  // Check title
  const title = await page.title();
  console.log('Title:', title);

  // Check HTML content
  const html = await page.content();
  console.log('Has DOCTYPE:', html.includes('<!DOCTYPE'));
  console.log('Has html tag:', html.includes('<html'));
  console.log('Has IBM Plex Mono:', html.includes('IBM Plex Mono'));
  console.log('Has #000000:', html.includes('#000000'));

  // Check computed background color
  const bgColor = await page.evaluate(function() {
    return window.getComputedStyle(document.body).backgroundColor;
  });
  console.log('Body background-color:', bgColor);

  // Check font family
  const fontFamily = await page.evaluate(function() {
    return window.getComputedStyle(document.body).fontFamily;
  });
  console.log('Body font-family:', fontFamily);

  // Take screenshot
  await page.screenshot({ path: '.playwright-cli/confessional-page.png', fullPage: true });
  console.log('Screenshot saved to .playwright-cli/confessional-page.png');

  await browser.close();
  console.log('VERIFICATION COMPLETE');
}

main().catch(function(e) { console.error(e); process.exit(1); });
