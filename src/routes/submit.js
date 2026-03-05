const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { getDb } = require('../database');
const { requireAgentAuth } = require('../middleware/auth');
const { submitLimiter } = require('../middleware/rate-limit');
const { sanitize } = require('../utils/sanitize');
const { scrubPii } = require('../utils/pii-scrub');
const { sha256 } = require('../utils/hash');

const router = express.Router();

/**
 * POST /confessional/submit — Agent confession submission
 *
 * Full 14-step validation chain (ordered):
 * 1. Content-Type must be application/json → 400
 * 2. Authorization header required with valid agt_ key → 401
 * 3. X-Session-ID header required → 400
 * 4. Session must exist → 404
 * 5. Session must be open → 403
 * 6. Compute session hash (SHA-256)
 * 7. Check session_attempts for existing attempt → 409
 * 8. Check for empty/absent/whitespace text → record attempt, return 200, do NOT store
 * 9. Text exceeding 2000 characters → 400
 * 10. Sanitize text
 * 11. Scrub PII
 * 12. Store confession with atomic transaction
 * 13. Return { received: true }
 */
router.post('/', submitLimiter, (req, res, next) => {
  // Step 1: Content-Type check (before auth, before JSON parse)
  const contentType = req.headers['content-type'] || '';
  if (!contentType.includes('application/json')) {
    return res.status(400).json({ error: 'Content-Type must be application/json' });
  }
  next();
}, requireAgentAuth, (req, res) => {
  const db = getDb();

  // Step 3: X-Session-ID header required
  const sessionId = req.headers['x-session-id'];
  if (!sessionId) {
    return res.status(400).json({ error: 'X-Session-ID header is required' });
  }

  // Step 4: Session must exist
  const session = db.prepare('SELECT id, status FROM sessions WHERE id = ?').get(sessionId);
  if (!session) {
    return res.status(404).json({ error: 'Session not found' });
  }

  // Step 5: Session must be open
  if (session.status !== 'open') {
    return res.status(403).json({ error: 'Session is closed' });
  }

  // Step 6: Compute session hash
  const sessionHash = sha256(sessionId);

  // Step 7: Check for existing attempt
  const existingAttempt = db.prepare('SELECT session_hash FROM session_attempts WHERE session_hash = ?').get(sessionHash);
  if (existingAttempt) {
    return res.status(409).json({ error: 'Already submitted for this session' });
  }

  // Step 8: Check for empty/absent/whitespace text
  const text = req.body ? req.body.text : undefined;
  const isEmptySubmission = text === undefined || text === null || (typeof text === 'string' && text.trim() === '');

  if (isEmptySubmission) {
    // Record the attempt but do NOT store a confession
    db.prepare('INSERT INTO session_attempts (session_hash) VALUES (?)').run(sessionHash);
    return res.status(200).json({ received: true });
  }

  // Step 9: Text length check
  if (typeof text !== 'string' || text.length > 2000) {
    return res.status(400).json({ error: 'Text must be a string of 2000 characters or fewer' });
  }

  // Step 10: Sanitize text
  let processedText = sanitize(text);

  // Step 11: Scrub PII
  processedText = scrubPii(processedText);

  // Step 12: Atomic transaction — insert confession and session_attempt together
  const confessionId = uuidv4();
  const insertConfession = db.prepare('INSERT INTO confessions (id, text, session_hash) VALUES (?, ?, ?)');
  const insertAttempt = db.prepare('INSERT INTO session_attempts (session_hash) VALUES (?)');

  const transaction = db.transaction(() => {
    insertConfession.run(confessionId, processedText, sessionHash);
    insertAttempt.run(sessionHash);
  });

  transaction();

  // Step 13: Consistent response — identical for stored, skipped, and scrubbed
  return res.status(200).json({ received: true });
});

module.exports = router;
