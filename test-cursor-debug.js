const http = require('http');

function request(method, path) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, 'http://localhost:3003');
    const opts = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      method
    };
    const req = http.request(opts, (res) => {
      var d = '';
      res.on('data', (c) => { d += c; });
      res.on('end', () => {
        resolve({ status: res.statusCode, body: JSON.parse(d) });
      });
    });
    req.on('error', reject);
    req.end();
  });
}

async function run() {
  // Get first page
  var res1 = await request('GET', '/confessional/feed?limit=3');
  console.log('Page 1: count=' + res1.body.count + ' total=' + res1.body.total);
  console.log('  next_cursor=' + res1.body.next_cursor);
  console.log('  first text: ' + (res1.body.confessions[0] ? res1.body.confessions[0].text.substring(0, 50) : 'none'));
  console.log('  last text: ' + (res1.body.confessions[2] ? res1.body.confessions[2].text.substring(0, 50) : 'none'));

  if (res1.body.next_cursor) {
    // Try with ?cursor= (wrong param name?)
    var res2a = await request('GET', '/confessional/feed?limit=3&cursor=' + encodeURIComponent(res1.body.next_cursor));
    console.log('\nWith ?cursor= : count=' + res2a.body.count);
    console.log('  first text: ' + (res2a.body.confessions[0] ? res2a.body.confessions[0].text.substring(0, 50) : 'none'));

    // Try with ?before=
    var res2b = await request('GET', '/confessional/feed?limit=3&before=' + encodeURIComponent(res1.body.next_cursor));
    console.log('\nWith ?before= : count=' + res2b.body.count);
    console.log('  first text: ' + (res2b.body.confessions[0] ? res2b.body.confessions[0].text.substring(0, 50) : 'none'));
    console.log('  next_cursor=' + res2b.body.next_cursor);

    // Check if texts are different between page 1 and page 2
    var p1last = res1.body.confessions[2] ? res1.body.confessions[2].text : '';
    var p2first = res2b.body.confessions[0] ? res2b.body.confessions[0].text : '';
    console.log('\nPage 1 last === Page 2 first? ' + (p1last === p2first));
  }
}

run().catch(e => console.error('Error:', e));
