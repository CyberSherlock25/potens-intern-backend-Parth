const createLogsTable = `
  CREATE TABLE IF NOT EXISTS logs (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    actor      TEXT    NOT NULL,
    action     TEXT    NOT NULL,
    payload    TEXT    NOT NULL,
    hash       TEXT    NOT NULL UNIQUE,
    prev_hash  TEXT    NOT NULL DEFAULT '',
    created_at TEXT    NOT NULL DEFAULT (datetime('now'))
  );
`;

module.exports = { createLogsTable };