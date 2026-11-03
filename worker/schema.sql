-- Language Buddy sync database (Cloudflare D1, SQLite).
-- Apply with:  npx wrangler d1 execute language-buddy-db --remote --file=schema.sql
-- One account per sync code (stored only as a SHA-256 hash). Each learner item
-- (a chat message, mistake, word, fact, day record, settings...) is one row.
-- `rev` grows by one for every write in an account, so a device can ask for
-- "everything after rev N". A row with d = NULL is a deletion.
CREATE TABLE IF NOT EXISTS accounts (
  id      TEXT PRIMARY KEY,
  rev     INTEGER NOT NULL DEFAULT 0,
  created INTEGER NOT NULL,
  updated INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS items (
  account TEXT NOT NULL,
  k       TEXT NOT NULL,
  d       TEXT,
  dev     TEXT NOT NULL,
  rev     INTEGER NOT NULL,
  updated INTEGER NOT NULL,
  PRIMARY KEY (account, k)
);
CREATE INDEX IF NOT EXISTS items_by_rev ON items (account, rev);
