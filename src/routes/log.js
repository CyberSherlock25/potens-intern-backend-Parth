const express = require('express');
const crypto = require('crypto');
const db = require('../db/database');
const authenticate = require('../middleware/auth');
const { postLimiter } = require('../middleware/rateLimiter');
const logger = require('../logger');

const router = express.Router();

// All routes require a valid API key
router.use(authenticate);

// ─────────────────────────────────────────────
// SHA-256 hash links each entry to the previous one.
// Changing ANY field in any entry breaks ALL subsequent hashes.
// ─────────────────────────────────────────────
function computeHash(id, actor, action, payload, prevHash) {
  const content = `${id}|${actor}|${action}|${JSON.stringify(payload)}|${prevHash}`;
  return crypto.createHash('sha256').update(content).digest('hex');
}

// ─────────────────────────────────────────────
// POST /log  — write a new entry
// ─────────────────────────────────────────────
router.post('/log', postLimiter, (req, res) => {
  const { actor, action, payload } = req.body;

  if (!actor || !action || !payload) {
    return res.status(400).json({ error: 'actor, action, and payload are all required.' });
  }

  // Get the last entry's hash to chain from
  const lastEntry = db.prepare('SELECT hash FROM logs ORDER BY id DESC LIMIT 1').get();
  const prevHash = lastEntry ? lastEntry.hash : '';

  // Transaction: insert with temp hash → get real id → compute hash → update
  const createEntry = db.transaction(() => {
    const result = db.prepare(
      'INSERT INTO logs (actor, action, payload, hash, prev_hash) VALUES (?, ?, ?, ?, ?)'
    ).run(actor, action, JSON.stringify(payload), 'PENDING', prevHash);

    const id = result.lastInsertRowid;
    const hash = computeHash(id, actor, action, payload, prevHash);

    db.prepare('UPDATE logs SET hash = ? WHERE id = ?').run(hash, id);

    return db.prepare('SELECT * FROM logs WHERE id = ?').get(id);
  });

  const entry = createEntry();
  logger.info({ event: 'log_created', id: entry.id, actor, action });

  res.status(201).json({
    id: entry.id,
    actor: entry.actor,
    action: entry.action,
    payload: JSON.parse(entry.payload),
    hash: entry.hash,
    prev_hash: entry.prev_hash,
    created_at: entry.created_at,
  });
});

// ─────────────────────────────────────────────
// GET /log/:id  — fetch one entry + verify its hash
// ─────────────────────────────────────────────
router.get('/log/:id', (req, res) => {
  const entry = db.prepare('SELECT * FROM logs WHERE id = ?').get(req.params.id);

  if (!entry) {
    return res.status(404).json({ error: 'Entry not found.' });
  }

  const payload = JSON.parse(entry.payload);
  const expectedHash = computeHash(entry.id, entry.actor, entry.action, payload, entry.prev_hash);
  const isValid = expectedHash === entry.hash;

  logger.info({ event: 'log_fetched', id: entry.id, chain_valid: isValid });

  res.json({
    id: entry.id,
    actor: entry.actor,
    action: entry.action,
    payload,
    hash: entry.hash,
    prev_hash: entry.prev_hash,
    created_at: entry.created_at,
    chain_status: isValid ? 'VALID' : 'TAMPERED',
  });
});

// ─────────────────────────────────────────────
// GET /verify  — scan the entire chain
// ─────────────────────────────────────────────
router.get('/verify', (req, res) => {
  const entries = db.prepare('SELECT * FROM logs ORDER BY id ASC').all();

  if (entries.length === 0) {
    return res.json({ status: 'PASS', message: 'No entries in the log.' });
  }

  let prevHash = '';

  for (const entry of entries) {
    const payload = JSON.parse(entry.payload);
    const expectedHash = computeHash(entry.id, entry.actor, entry.action, payload, entry.prev_hash);

    if (expectedHash !== entry.hash) {
      logger.warn({ event: 'verify_failed', id: entry.id, reason: 'hash_mismatch' });
      return res.json({ status: 'FAIL', broken_at_id: entry.id, reason: 'Hash mismatch — entry was tampered.' });
    }

    if (entry.prev_hash !== prevHash) {
      logger.warn({ event: 'verify_failed', id: entry.id, reason: 'chain_broken' });
      return res.json({ status: 'FAIL', broken_at_id: entry.id, reason: 'Chain broken — entry deleted or reordered.' });
    }

    prevHash = entry.hash;
  }

  logger.info({ event: 'verify_passed', total_entries: entries.length });
  res.json({ status: 'PASS', total_entries: entries.length });
});

// ─────────────────────────────────────────────
// GET /export  — filtered JSON export
// Query params: ?actor=alice&from=2026-01-01&to=2026-12-31
// ─────────────────────────────────────────────
router.get('/export', (req, res) => {
  const { actor, from, to } = req.query;

  let query = 'SELECT * FROM logs WHERE 1=1';
  const params = [];

  if (actor) { query += ' AND actor = ?'; params.push(actor); }
  if (from)  { query += ' AND created_at >= ?'; params.push(from); }
  if (to)    { query += ' AND created_at <= ?'; params.push(to); }

  query += ' ORDER BY id ASC';

  const entries = db.prepare(query).all(...params);
  logger.info({ event: 'export', count: entries.length });

  res.json(entries.map(e => ({
    id: e.id,
    actor: e.actor,
    action: e.action,
    payload: JSON.parse(e.payload),
    hash: e.hash,
    prev_hash: e.prev_hash,
    created_at: e.created_at,
  })));
});

module.exports = router;