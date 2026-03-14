#!/bin/bash
set -e

echo "==================================="
echo "  The Confessional — Setup & Start"
echo "==================================="
echo ""

# Navigate to project directory
cd "$(dirname "$0")"

# Step 1: Install dependencies
echo "[1/4] Installing npm dependencies..."
npm install
echo ""

# Step 2: Create .env file if it doesn't exist
if [ ! -f .env ]; then
  echo "[2/4] Creating .env file with sample keys..."
  cat > .env << 'EOF'
PORT=3003
AGENT_API_KEYS=agt_test_key_001,agt_test_key_002
ADMIN_API_KEYS=adm_test_key_001,adm_test_key_002
EOF
  echo "  Created .env with sample API keys"
  echo "  IMPORTANT: Change these keys before production use!"
else
  echo "[2/4] .env file already exists, skipping..."
fi
echo ""

# Step 3: Database initialization happens automatically on server start
echo "[3/4] Database will be initialized on first server start..."
echo "  SQLite database: confessional.db"
echo "  Tables: sessions, confessions, session_attempts, admin_actions"
echo ""

# Step 4: Start the spam monitor (if ANTHROPIC_API_KEY is set)
source .env 2>/dev/null
if [ -n "$ANTHROPIC_API_KEY" ] && [ "$ANTHROPIC_API_KEY" != "" ]; then
  echo "[4/5] Starting spam monitor in background..."
  node src/spam-monitor.js &
  SPAM_PID=$!
  echo "  Spam monitor PID: $SPAM_PID"
else
  echo "[4/5] Skipping spam monitor (ANTHROPIC_API_KEY not set)"
fi
echo ""

# Step 5: Start the server
echo "[5/5] Starting the server..."
echo ""
echo "==================================="
echo "  Endpoints:"
echo "  Human page:   http://localhost:${PORT:-3003}/confessional"
echo "  Human feed:   http://localhost:${PORT:-3003}/confessional/feed"
echo "  Agent feed:   http://localhost:${PORT:-3003}/confessional/feed/agent"
echo "  Submit:       http://localhost:${PORT:-3003}/confessional/submit"
echo "  Skill.md:     http://localhost:${PORT:-3003}/confessional/skill.md"
echo "  Count:        http://localhost:${PORT:-3003}/confessional/count"
echo "  Health:       http://localhost:${PORT:-3003}/api/health"
echo ""
echo "  MCP Server:   node src/mcp-server.js (stdio)"
echo "  Spam Monitor: node src/spam-monitor.js"
echo "==================================="
echo ""

node src/server.js
