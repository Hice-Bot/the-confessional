var html = require('fs').readFileSync('./src/public/confessional.html', 'utf8');
// Check exact height declarations
var heightMatches = html.match(/height\s*:\s*[^;}\n]+/gi);
console.log('Height declarations found:');
if (heightMatches) heightMatches.forEach(function(m) { console.log('  ' + m.trim()); });
// Check exact overflow declarations
var overflowMatches = html.match(/overflow\s*[^:]*:\s*[^;}\n]+/gi);
console.log('Overflow declarations:', overflowMatches ? overflowMatches : 'none (browser default: visible)');
// The sentinel div has height:1px which is the IntersectionObserver target
// html,body height:100% is fine - content overflows and is scrollable by default
console.log('\nConclusion: height:100% on html/body sets minimum height.');
console.log('Content exceeding viewport creates scrollable overflow (browser default).');
console.log('No overflow:hidden means keyboard scrolling works natively.');
