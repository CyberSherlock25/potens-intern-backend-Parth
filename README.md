Entry 1: prev_hash = "" (nothing before it)
Entry 2: prev_hash = hash of entry 1
Entry 3: prev_hash = hash of entry 2

Editing entry 2 changes its hash.
But entry 3's prev_hash still points to the OLD hash of entry 2.
This mismatch is exactly what /verify catches.

---

## Design Decisions

**SQLite over PostgreSQL**
This is an append-only log — no concurrent writes, no complex joins,
no distributed access needed. SQLite with WAL mode handles this perfectly
and requires zero infrastructure setup. Swapping to Postgres later would
only require changing src/db/database.js. Justified for a 24-hour build.

**Transaction on write**
The POST /log handler uses a SQLite transaction to insert with a
placeholder hash, capture the real auto-incremented id, compute the
correct hash using that id, then update. This keeps the chain mathematically
consistent even under rapid sequential writes.

**Rate limit on POST only**
GET endpoints are read-only and safe to call freely. POST is capped at
20 requests per minute per IP to prevent log flooding and replay attacks.

**API key in header**
Simple and effective for a 24-hour build. In production this would be
replaced with JWT tokens, key rotation, and scoped permissions.

---

## What is Broken or Unfinished

- The `audit.db` file is excluded from git via .gitignore — reviewers
  must start fresh with npm run dev and add their own entries.
- No Merkle tree batching (stretch goal) — /verify does a full table
  scan which is fine up to around 50,000 rows.
- No docker-compose (stretch goal).
- No CLI `npm run verify` as a separate script file (stretch goal) —
  the logic lives in the route itself.

---

## What I Would Build Next

- Merkle tree batching: group entries into leaves, store root hash per
  batch, verify by batch for O(log n) performance on large logs.
- docker-compose with a Postgres variant so the whole thing boots with
  one command.
- Key rotation endpoint (admin only) with old key grace period.
- Webhook on /verify failure to alert a Slack channel automatically.
- A read replica for export queries so heavy exports don't block writes.

---

## Project Structure 
src/
├── db/
│   ├── database.js              # SQLite connection and migration runner
│   └── migrations/
│       └── 001_create_logs.js   # Schema: logs table definition
├── middleware/
│   ├── auth.js                  # API key authentication
│   └── rateLimiter.js           # POST rate limiting (20/min/IP)
├── routes/
│   └── log.js                   # All four endpoints + chain logic
├── app.js                       # Express app setup
├── logger.js                    # Pino structured logger
└── server.js                    # Server entry point 

 ## AI USE LOG

| Tool | Approx messages | Used for |
|------|----------------|----------|
| Claude (claude.ai) | Complete project guidance — architecture decisions, all code files, Windows setup commands, debugging, demo script, and this README |

**Note:** This was my first backend project built under time pressure.
I used Claude as a senior engineer mentor throughout — asking it to
explain every decision, not just generate code. I understood and can
explain every line in this codebase. The SHA-256 chaining logic,
transaction pattern, and tamper detection design were all explained
to me step by step before I wrote 