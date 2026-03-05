var http = require('http');

var options = {
    hostname: 'localhost',
    port: 3003,
    path: '/confessional/feed/agent?limit=500',
    method: 'GET',
    headers: {
        'Authorization': 'Bearer agt_test_key_001'
    }
};

var req = http.request(options, function(res) {
    var data = '';
    res.on('data', function(chunk) { data += chunk; });
    res.on('end', function() {
        var json = JSON.parse(data);
        console.log('Agent feed - Status code:', res.statusCode);
        console.log('Agent feed - Confessions count:', json.confessions.length);
        console.log('Agent feed - Capped at 100:', json.confessions.length <= 100);
    });
});
req.end();
