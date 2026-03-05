const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { getDb } = require('../database');
const { requireAdminAuth } = require('../middleware/auth');

const router = express.Router();

/**
 * POST /confessional/sessions — Create a new session
 * Body: { "agent_id": "uuid" }
 * Requires adm_ bearer token.
 * Returns: { "session_id": "uuid", "status": "open" }
 */
router.post('/', requireAdminAuth, (req, res) => {
  const db = getDb();
  const { agent_id } = req.body || {};

  if (!agent_id) {
    return res.status(400).json({ error: 'agent_id is required' });
  }

  const sessionId = uuidv4();
  db.prepare('INSERT INTO sessions (id, agent_id) VALUES (?, ?)').run(sessionId, agent_id);

  res.json({ session_id: sessionId, status: 'open' });
});

/**
 * POST /confessional/sessions/:id/close — Close a session
 * Requires adm_ bearer token.
 * Returns: { "session_id": "uuid", "status": "closed" }
 */
router.post('/:id/close', requireAdminAuth, (req, res) => {
  const db = getDb();
  const sessionId = req.params.id;

  const session = db.prepare('SELECT id, status FROM sessions WHERE id = ?').get(sessionId);
  if (!session) {
    return res.status(404).json({ error: 'Session not found' });
  }

  db.prepare('UPDATE sessions SET status = ? WHERE id = ?').run('closed', sessionId);

  res.json({ session_id: sessionId, status: 'closed' });
});

module.exports = router;
