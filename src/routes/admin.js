const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { getDb } = require('../database');
const { requireAdminAuth } = require('../middleware/auth');

const router = express.Router();

/**
 * POST /confessional/admin/flag — Flag a confession (hide from all feeds)
 * Body: { "id": "confession_id", "note": "optional" }
 * Requires adm_ bearer token.
 */
router.post('/flag', requireAdminAuth, (req, res) => {
  const db = getDb();
  const { id, note } = req.body || {};

  if (!id) {
    return res.status(400).json({ error: 'Confession id is required' });
  }

  const confession = db.prepare('SELECT id FROM confessions WHERE id = ?').get(id);
  if (!confession) {
    return res.status(404).json({ error: 'Confession not found' });
  }

  db.prepare('UPDATE confessions SET flagged = 1 WHERE id = ?').run(id);

  // Log admin action
  db.prepare('INSERT INTO admin_actions (id, action, confession_id, admin_key_prefix, note) VALUES (?, ?, ?, ?, ?)').run(
    uuidv4(), 'flag', id, req.adminKeyPrefix, note || null
  );

  res.json({ success: true, message: 'Confession flagged' });
});

/**
 * POST /confessional/admin/unflag — Unflag a confession (restore to feeds)
 * Body: { "id": "confession_id", "note": "optional" }
 * Requires adm_ bearer token.
 */
router.post('/unflag', requireAdminAuth, (req, res) => {
  const db = getDb();
  const { id, note } = req.body || {};

  if (!id) {
    return res.status(400).json({ error: 'Confession id is required' });
  }

  const confession = db.prepare('SELECT id FROM confessions WHERE id = ?').get(id);
  if (!confession) {
    return res.status(404).json({ error: 'Confession not found' });
  }

  db.prepare('UPDATE confessions SET flagged = 0 WHERE id = ?').run(id);

  // Log admin action
  db.prepare('INSERT INTO admin_actions (id, action, confession_id, admin_key_prefix, note) VALUES (?, ?, ?, ?, ?)').run(
    uuidv4(), 'unflag', id, req.adminKeyPrefix, note || null
  );

  res.json({ success: true, message: 'Confession unflagged' });
});

/**
 * DELETE /confessional/admin/confessions/:id — Hard delete a confession
 * Body (optional): { "note": "optional" }
 * Requires adm_ bearer token.
 * Removes the confession row entirely. Logs action with null confession_id.
 */
router.delete('/confessions/:id', requireAdminAuth, (req, res) => {
  const db = getDb();
  const confessionId = req.params.id;
  const { note } = req.body || {};

  const confession = db.prepare('SELECT id FROM confessions WHERE id = ?').get(confessionId);
  if (!confession) {
    return res.status(404).json({ error: 'Confession not found' });
  }

  db.prepare('DELETE FROM confessions WHERE id = ?').run(confessionId);

  // Log admin action with null confession_id (row no longer exists)
  db.prepare('INSERT INTO admin_actions (id, action, confession_id, admin_key_prefix, note) VALUES (?, ?, ?, ?, ?)').run(
    uuidv4(), 'delete', null, req.adminKeyPrefix, note || null
  );

  res.json({ success: true, message: 'Confession deleted' });
});

module.exports = router;
