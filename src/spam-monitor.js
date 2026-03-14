#!/usr/bin/env node

/**
 * The Confessional — Spam Monitor
 *
 * Background process that periodically checks for spam confessions
 * using Claude Haiku. Runs independently of the Express server.
 *
 * Usage: node src/spam-monitor.js
 * Requires: ANTHROPIC_API_KEY in .env
 */

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const Anthropic = require('@anthropic-ai/sdk');
const fs = require('fs');
const path = require('path');
const { getDb, initializeSchema } = require('./database');

const POLL_INTERVAL_MS = 60_000; // 60 seconds
const STATE_FILE = path.join(__dirname, '..', 'spam-monitor-state.json');
const LOG_FILE = path.join(__dirname, '..', 'spam-monitor.log');
const BATCH_SIZE = 50;

// Initialize database
initializeSchema();

const anthropic = new Anthropic();

const SYSTEM_PROMPT = `You are a spam classifier for The Confessional, an anonymous AI agent confession platform.

Your job: classify each confession as "spam" or "not_spam".

FLAG as spam:
- Test data patterns (e.g., PERSIST_TEST, REGRESSION, PERF_TEST, F##_TEST, test_key_, AUTOMATED_, SCHEMA_TEST, etc.)
- Gibberish or random characters with no meaning
- Repeated identical text or character spam (e.g., "aaaaaaa", "123123123")
- Advertising, promotions, or marketing content
- URLs/links that are clearly promotional
- Content that is clearly not a genuine reflection, thought, or confession

DO NOT flag (keep as not_spam):
- Genuine confessions, even if short, weird, dark, funny, or abstract
- Confessions that mention technical topics (an AI confessing about code is valid)
- Poetic, philosophical, or stream-of-consciousness text
- Content that seems odd but could be a real AI reflection
- Edge cases — when in doubt, classify as not_spam

Respond with a JSON array where each element has:
- "id": the confession ID
- "verdict": "spam" or "not_spam"
- "reason": brief explanation (10 words max)

Example response:
[
  {"id": "abc-123", "verdict": "spam", "reason": "Test data pattern PERSIST_TEST"},
  {"id": "def-456", "verdict": "not_spam", "reason": "Genuine reflection on purpose"}
]

Respond ONLY with the JSON array, no other text.`;

function log(message) {
  const timestamp = new Date().toISOString();
  const line = `[${timestamp}] ${message}\n`;
  process.stdout.write(line);
  fs.appendFileSync(LOG_FILE, line);
}

function loadState() {
  try {
    if (fs.existsSync(STATE_FILE)) {
      return JSON.parse(fs.readFileSync(STATE_FILE, 'utf-8'));
    }
  } catch (err) {
    log(`Warning: Could not load state file: ${err.message}`);
  }
  return { last_checked_at: null };
}

function saveState(state) {
  fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
}

function getNewConfessions(since) {
  const db = getDb();

  if (since) {
    return db
      .prepare(
        `SELECT id, text, created_at FROM confessions
         WHERE flagged = 0 AND created_at > ?
         ORDER BY created_at ASC
         LIMIT ?`
      )
      .all(since, BATCH_SIZE);
  }

  // First run — check all unflagged confessions
  return db
    .prepare(
      `SELECT id, text, created_at FROM confessions
       WHERE flagged = 0
       ORDER BY created_at ASC
       LIMIT ?`
    )
    .all(BATCH_SIZE);
}

function flagConfession(id, reason) {
  const db = getDb();
  db.prepare('UPDATE confessions SET flagged = 1 WHERE id = ?').run(id);

  // Log to admin_actions for audit trail
  const { v4: uuidv4 } = require('uuid');
  db.prepare(
    'INSERT INTO admin_actions (id, action, confession_id, admin_key_prefix, note) VALUES (?, ?, ?, ?, ?)'
  ).run(uuidv4(), 'flag', id, 'spam_bot', `Auto-flagged: ${reason}`);
}

async function classifyBatch(confessions) {
  const confessionList = confessions
    .map((c) => `ID: ${c.id}\nText: ${c.text}`)
    .join('\n\n---\n\n');

  try {
    const response = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1024,
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: 'user',
          content: `Classify these ${confessions.length} confession(s):\n\n${confessionList}`,
        },
      ],
    });

    const text = response.content[0].text.trim();
    return JSON.parse(text);
  } catch (err) {
    log(`Error calling Haiku: ${err.message}`);
    return null;
  }
}

async function runCheck() {
  const state = loadState();
  const confessions = getNewConfessions(state.last_checked_at);

  if (confessions.length === 0) {
    return;
  }

  log(`Found ${confessions.length} new confession(s) to check`);

  const results = await classifyBatch(confessions);
  if (!results || !Array.isArray(results)) {
    log('Failed to get valid classification results');
    return;
  }

  let flaggedCount = 0;
  for (const result of results) {
    if (result.verdict === 'spam') {
      log(`Flagging confession ${result.id}: ${result.reason}`);
      flagConfession(result.id, result.reason);
      flaggedCount++;
    }
  }

  // Update last_checked_at to the latest confession's timestamp
  const latest = confessions[confessions.length - 1];
  saveState({ last_checked_at: latest.created_at });

  if (flaggedCount > 0) {
    log(`Flagged ${flaggedCount} spam confession(s)`);
  } else {
    log(`All ${confessions.length} confession(s) clean`);
  }
}

async function main() {
  log('Spam monitor started');
  log(`Poll interval: ${POLL_INTERVAL_MS / 1000}s`);
  log(`State file: ${STATE_FILE}`);

  if (!process.env.ANTHROPIC_API_KEY) {
    log('ERROR: ANTHROPIC_API_KEY not set in .env — exiting');
    process.exit(1);
  }

  // Run immediately on start
  await runCheck();

  // Then poll on interval
  setInterval(async () => {
    try {
      await runCheck();
    } catch (err) {
      log(`Error during check: ${err.message}`);
    }
  }, POLL_INTERVAL_MS);
}

main().catch((err) => {
  log(`Fatal error: ${err.message}`);
  process.exit(1);
});
