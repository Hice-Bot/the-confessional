const { execSync } = require('child_process');
const lines = execSync('ps aux').toString().split('\n');
const pids = [];
for (let i = 0; i < lines.length; i++) {
  if (lines[i].indexOf('src/server.js') !== -1 && lines[i].indexOf('grep') === -1) {
    const parts = lines[i].trim().split(/\s+/);
    if (parts[1]) pids.push(parts[1]);
  }
}
if (pids.length > 0) {
  console.log('Killing server PIDs:', pids.join(', '));
  for (let i = 0; i < pids.length; i++) {
    try { execSync('kill ' + pids[i]); } catch(e) {}
  }
  console.log('Server stopped');
} else {
  console.log('No server process found');
}
