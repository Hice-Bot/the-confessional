var http = require('http');

var options = {
    hostname: 'localhost',
    port: 3003,
    path: '/confessional/feed?limit=500',
    method: 'GET'
};

var req = http.request(options, function(res) {
    var data = '';
    res.on('data', function(chunk) { data += chunk; });
    res.on('end', function() {
        var json = JSON.parse(data);
        console.log('Status code:', res.statusCode);
        console.log('Confessions count in response:', json.confessions.length);
        console.log('count field:', json.count);
        console.log('total field:', json.total);
        console.log('next_cursor:', json.next_cursor ? 'present (not null)' : 'null');
        console.log('Has valid JSON structure:', typeof json.confessions === 'object' && Array.isArray(json.confessions));

        if (json.confessions.length <= 100) {
            console.log('PASS: limit capped at 100 or less (got ' + json.confessions.length + ')');
        } else {
            console.log('FAIL: returned more than 100 confessions (' + json.confessions.length + ')');
        }

        if (res.statusCode === 200) {
            console.log('PASS: No server error (200)');
        } else {
            console.log('FAIL: Server returned error status ' + res.statusCode);
        }
    });
});
req.end();
