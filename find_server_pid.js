var exec = require('child_process').execSync;
var result = exec('ps aux').toString();
var lines = result.split('\n');
lines.forEach(function(line) {
  if (line.indexOf('server.js') !== -1 && line.indexOf('node') !== -1) {
    console.log(line);
  }
});
