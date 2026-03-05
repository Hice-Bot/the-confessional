#!/bin/bash
# Find and kill the server
SERVER_PID=$(node -e "
const http = require('http');
const req = http.get('http://localhost:3003/api/health', () => {});
req.on('error', () => {});
" 2>&1)

# Kill node processes running server.js
kill $(node -e "
const { execSync } = require('child_process');
const out = execSync('ps aux').toString();
const lines = out.split('\n').filter(l => l.includes('node') && l.includes('server.js') && !l.includes('grep'));
lines.forEach(l => {
  const parts = l.trim().split(/\s+/);
  console.log(parts[1]);
});
") 2>/dev/null

echo "Server killed"
sleep 3
echo "Starting server..."

cd /mnt/c/Users/turke/the-confessional
node src/server.js &
sleep 2

echo "Checking health..."
curl -s http://localhost:3003/api/health
echo ""

echo "Checking feed for persistence..."
curl -s http://localhost:3003/confessional/feed
echo ""
echo "DONE"
