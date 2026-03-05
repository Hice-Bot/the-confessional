const http = require('http');

const BASE = 'http://localhost:3003';
const UNIQUE_TEXT = 'REGTEST-PERSIST-WALRUS-FALCON-ORCHID-VELVET-ZEPHYR-KUMQUAT-MANGO';

function request(method, path) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE);
    const opts = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      method,
      headers: { 'Content-Type': 'application/json' }
    };
    const req = http.request(opts, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(data) }); }
        catch { resolve({ status: res.statusCode, body: data }); }
      });
    });
    req.on('error', reject);
    req.end();
  });
}

async function main() {
  console.log('Checking feed after restart for: ' + UNIQUE_TEXT);
  let found = false;
  let cursor = null;
  let page = 0;
  while (!found && page < 10) {
    const feedUrl = cursor
      ? '/confessional/feed?cursor=' + encodeURIComponent(cursor)
      : '/confessional/feed';
    const feedRes = await request('GET', feedUrl);
    const confessions = feedRes.body.confessions || feedRes.body || [];
    for (const c of confessions) {
      if (c.text === UNIQUE_TEXT) {
        found = true;
        console.log('FOUND confession: ' + c.text);
        break;
      }
    }
    cursor = feedRes.body.next_cursor;
    page++;
    if (!cursor) break;
  }

  if (found) {
    console.log('POST-RESTART PASS - Data persisted across server restart');
  } else {
    console.log('POST-RESTART FAIL - Confession not found after restart (searched ' + page + ' pages)');
    process.exit(1);
  }
}

main().catch(e => { console.error(e); process.exit(1); });
