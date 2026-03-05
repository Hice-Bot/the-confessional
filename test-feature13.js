var http = require('http');

function run() {
  return new Promise(function(resolve, reject) {
    var opts = {
      method: 'GET',
      hostname: 'localhost',
      port: 3003,
      path: '/confessional',
      headers: {}
    };

    var req = http.request(opts, function(res) {
      var body = '';
      res.on('data', function(c) { body += c; });
      res.on('end', function() {
        console.log('=== Feature #13: No cookies or tracking on human page ===\n');

        // Step 1: Capture all response headers
        console.log('Step 1: Response headers:');
        var headers = res.headers;
        var headerKeys = Object.keys(headers);
        headerKeys.forEach(function(key) {
          console.log('  ' + key + ': ' + headers[key]);
        });

        // Step 2: Check for Set-Cookie header
        console.log('\nStep 2: Check for Set-Cookie header...');
        var rawHeaders = res.rawHeaders;
        var setCookieFound = false;
        for (var i = 0; i < rawHeaders.length; i += 2) {
          if (rawHeaders[i].toLowerCase() === 'set-cookie') {
            setCookieFound = true;
            console.log('  FAIL: Set-Cookie header found: ' + rawHeaders[i+1]);
          }
        }
        if (!setCookieFound) {
          console.log('  PASS: No Set-Cookie header present');
        }

        // Step 3: Read the HTML body
        console.log('\nStep 3: HTML body length: ' + body.length + ' chars');

        // Step 4: Check for tracking scripts
        console.log('\nStep 4: Check for tracking/analytics scripts...');
        var trackingPatterns = [
          { name: 'Google Analytics (gtag)', pattern: /gtag/i },
          { name: 'Google Analytics (ga.js)', pattern: /google-analytics\.com/i },
          { name: 'Google Analytics (analytics.js)', pattern: /analytics\.js/i },
          { name: 'Google Tag Manager', pattern: /googletagmanager\.com/i },
          { name: 'Facebook Pixel', pattern: /facebook\.net\/en_US\/fbevents/i },
          { name: 'Facebook Pixel (fbq)', pattern: /fbq\s*\(/i },
          { name: 'Hotjar', pattern: /hotjar\.com/i },
          { name: 'Mixpanel', pattern: /mixpanel\.com/i },
          { name: 'Segment', pattern: /segment\.com\/analytics/i },
          { name: 'Amplitude', pattern: /amplitude\.com/i },
          { name: 'Heap Analytics', pattern: /heap\.io/i },
          { name: 'Intercom', pattern: /intercom\.io/i },
          { name: 'Crisp', pattern: /crisp\.chat/i },
          { name: 'Plausible', pattern: /plausible\.io/i },
          { name: 'Matomo/Piwik', pattern: /matomo|piwik/i },
          { name: 'tracking pixel (1x1 img)', pattern: /width=["']?1["']?\s+height=["']?1/i },
          { name: 'data-analytics', pattern: /data-analytics/i },
          { name: 'beacon API tracking', pattern: /navigator\.sendBeacon/i },
        ];

        var trackingFound = false;
        trackingPatterns.forEach(function(tp) {
          if (tp.pattern.test(body)) {
            console.log('  FAIL: ' + tp.name + ' detected');
            trackingFound = true;
          }
        });
        if (!trackingFound) {
          console.log('  PASS: No tracking/analytics scripts found');
        }

        // Step 5: Check for localStorage/sessionStorage usage
        console.log('\nStep 5: Check for localStorage/sessionStorage usage...');
        var localStorageUsed = /localStorage/i.test(body);
        var sessionStorageUsed = /sessionStorage/i.test(body);
        if (localStorageUsed) {
          console.log('  FAIL: localStorage usage found in page JavaScript');
        } else {
          console.log('  PASS: No localStorage usage');
        }
        if (sessionStorageUsed) {
          console.log('  FAIL: sessionStorage usage found in page JavaScript');
        } else {
          console.log('  PASS: No sessionStorage usage');
        }

        // Step 6: Check for fingerprinting scripts
        console.log('\nStep 6: Check for fingerprinting scripts...');
        var fingerprintPatterns = [
          { name: 'FingerprintJS', pattern: /fingerprint/i },
          { name: 'Canvas fingerprint', pattern: /toDataURL.*canvas|canvas.*toDataURL/i },
          { name: 'WebGL fingerprint', pattern: /webgl.*renderer|WEBGL/i },
          { name: 'Audio fingerprint', pattern: /AudioContext.*fingerprint|createOscillator.*fingerprint/i },
          { name: 'navigator.plugins', pattern: /navigator\.plugins/i },
          { name: 'navigator.mimeTypes', pattern: /navigator\.mimeTypes/i },
          { name: 'navigator.userAgent tracking', pattern: /navigator\.userAgent/i },
          { name: 'screen resolution tracking', pattern: /screen\.width.*screen\.height|screen\.colorDepth/i },
        ];

        var fingerprintFound = false;
        fingerprintPatterns.forEach(function(fp) {
          if (fp.pattern.test(body)) {
            console.log('  FAIL: ' + fp.name + ' detected');
            fingerprintFound = true;
          }
        });
        if (!fingerprintFound) {
          console.log('  PASS: No fingerprinting scripts found');
        }

        // Summary
        var checks = [
          { name: 'No Set-Cookie header', pass: !setCookieFound },
          { name: 'No tracking/analytics scripts', pass: !trackingFound },
          { name: 'No localStorage usage', pass: !localStorageUsed },
          { name: 'No sessionStorage usage', pass: !sessionStorageUsed },
          { name: 'No fingerprinting scripts', pass: !fingerprintFound },
        ];

        console.log('\n=== Verification Summary ===');
        checks.forEach(function(c) {
          console.log('  ' + (c.pass ? 'PASS' : 'FAIL') + ': ' + c.name);
        });

        var allPass = checks.every(function(c) { return c.pass; });
        console.log('\n=== OVERALL: ' + (allPass ? 'ALL CHECKS PASSED' : 'SOME CHECKS FAILED') + ' ===');
        resolve();
      });
    });

    req.on('error', reject);
    req.end();
  });
}

run().catch(console.error);
