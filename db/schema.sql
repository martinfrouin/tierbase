CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE TABLE IF NOT EXISTS titles (
  id INTEGER PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  romaji TEXT,
  search TEXT NOT NULL,
  kind TEXT NOT NULL,
  origin TEXT NOT NULL,
  status TEXT,
  genres JSONB NOT NULL DEFAULT '[]',
  cover TEXT NOT NULL DEFAULT '',
  url TEXT NOT NULL DEFAULT '',
  popularity INTEGER NOT NULL DEFAULT 0
);
ALTER TABLE titles ADD COLUMN IF NOT EXISTS native TEXT;
CREATE INDEX IF NOT EXISTS titles_search ON titles USING gin (search gin_trgm_ops);

CREATE TABLE IF NOT EXISTS threads (
  id TEXT PRIMARY KEY,
  subreddit TEXT NOT NULL,
  title TEXT NOT NULL,
  url TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL,
  analyzed_comments INTEGER NOT NULL
);

-- One row per (Reddit comment, title it cites)
CREATE TABLE IF NOT EXISTS mentions (
  comment_id TEXT NOT NULL,
  title_id INTEGER NOT NULL REFERENCES titles(id),
  thread_id TEXT NOT NULL REFERENCES threads(id) ON DELETE CASCADE,
  author TEXT NOT NULL,
  score INTEGER NOT NULL,
  body TEXT NOT NULL,
  PRIMARY KEY (comment_id, title_id)
);
CREATE INDEX IF NOT EXISTS mentions_title ON mentions(title_id);

CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY,
  share_id TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
-- Shown as the title of the shared tier list
ALTER TABLE users ADD COLUMN IF NOT EXISTS list_name TEXT;

-- tier: S..D, or NULL for "want to read" / "not interested" entries
CREATE TABLE IF NOT EXISTS ratings (
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title_id INTEGER NOT NULL REFERENCES titles(id),
  tier CHAR(1) CHECK (tier IN ('S', 'A', 'B', 'C', 'D')),
  state TEXT NOT NULL CHECK (state IN ('rated', 'want', 'skip')),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, title_id)
);
CREATE INDEX IF NOT EXISTS ratings_title ON ratings(title_id);

-- A "basket" is a set of titles one reader likes: everything a Reddit user cited, or a site user's S/A titles.
-- Grouping by Reddit author keeps a list pasted in many threads from counting many times.
CREATE OR REPLACE VIEW baskets AS
  SELECT DISTINCT 'r:' || author AS basket, title_id FROM mentions
  UNION ALL
  SELECT 'u:' || user_id AS basket, title_id FROM ratings WHERE tier IN ('S', 'A');
