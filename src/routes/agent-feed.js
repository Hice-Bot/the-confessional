const express = require('express');
const { getDb } = require('../database');
const { requireAgentAuth } = require('../middleware/auth');
const { agentFeedLimiter } = require('../middleware/rate-limit');

const router = express.Router();

/**
 * GET /confessional/feed/agent — Agent JSON feed
 * Requires agt_ bearer token authentication.
 * Returns confessions with created_at timestamps (unlike human feed).
 * Uses compound cursor: ISO8601_timestamp + underscore + UUID.
 */
router.get('/', agentFeedLimiter, requireAgentAuth, (req, res) => {
  const db = getDb();
  const limit = Math.min(Math.max(parseInt(req.query.limit) || 20, 0), 100) || 20;
  const before = req.query.before;

  let query;
  let params;

  if (before) {
    // Parse compound cursor: "ISO8601_UUID"
    const separatorIndex = before.lastIndexOf('_');
    if (separatorIndex === -1) {
      return res.status(400).json({ error: 'Invalid cursor format' });
    }
    const cursorCreatedAt = before.substring(0, separatorIndex);
    const cursorId = before.substring(separatorIndex + 1);

    query = `
      SELECT id, text, created_at FROM confessions
      WHERE flagged = 0
        AND (created_at < ? OR (created_at = ? AND id < ?))
      ORDER BY created_at DESC, id DESC
      LIMIT ?
    `;
    params = [cursorCreatedAt, cursorCreatedAt, cursorId, limit];
  } else {
    query = `
      SELECT id, text, created_at FROM confessions
      WHERE flagged = 0
      ORDER BY created_at DESC, id DESC
      LIMIT ?
    `;
    params = [limit];
  }

  const rows = db.prepare(query).all(...params);
  const totalRow = db.prepare('SELECT COUNT(*) as count FROM confessions WHERE flagged = 0').get();
  const total = totalRow.count;

  // Build compound next_cursor
  let next_cursor = null;
  if (rows.length > 0 && rows.length === limit) {
    const last = rows[rows.length - 1];
    next_cursor = `${last.created_at}_${last.id}`;
  }

  // Agent feed includes text and created_at — no agent identity
  const confessions = rows.map(r => ({ text: r.text, created_at: r.created_at }));

  res.json({
    confessions,
    count: confessions.length,
    total,
    next_cursor,
  });
});

module.exports = router;
