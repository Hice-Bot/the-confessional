const http = require('http');

http.get('http://localhost:3003/confessional/feed?limit=2', (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    const j = JSON.parse(data);
    console.log('Feed count:', j.count);
    console.log('Total:', j.total);
    console.log('Has confessions:', j.confessions.length > 0);
    if (j.confessions[0]) {
      console.log('First text preview:', j.confessions[0].text.substring(0, 50));
    }
  });
});
