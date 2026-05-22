const Database = require('better-sqlite3');
const path = require('path');
const { createLogsTable } = require('./migrations/001_create_logs');

// SQLite chosen: append-only logs have no concurrent writes,
// zero infra setup, boots instantly. Swap to Postgres = change this file only.
const DB_PATH = path.join(__dirname, '../../audit.db');

const db = new Database(DB_PATH);

// WAL mode: better read performance alongside writes
db.pragma('journal_mode = WAL');

// Run migration on every startup (CREATE TABLE IF NOT EXISTS = safe)
db.exec(createLogsTable);

module.exports = db;