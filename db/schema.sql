-- Runs while the site is live: give up rather than queue every page behind a lock held by a stuck connection
SET lock_timeout = '10s';

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
ALTER TABLE titles ADD COLUMN IF NOT EXISTS description TEXT;
CREATE INDEX IF NOT EXISTS titles_search ON titles USING gin (search gin_trgm_ops);
-- 'reading' (manga, manhwa, manhua) or 'games'. A game and a manga may share a slug.
ALTER TABLE titles ADD COLUMN IF NOT EXISTS universe TEXT NOT NULL DEFAULT 'reading';
ALTER TABLE titles DROP CONSTRAINT IF EXISTS titles_slug_key;
CREATE UNIQUE INDEX IF NOT EXISTS titles_universe_slug ON titles (universe, slug);
-- First release year, for games (tells remakes and remasters apart)
ALTER TABLE titles ADD COLUMN IF NOT EXISTS year INTEGER;

CREATE TABLE IF NOT EXISTS threads (
  id TEXT PRIMARY KEY,
  subreddit TEXT NOT NULL,
  title TEXT NOT NULL,
  url TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL,
  analyzed_comments INTEGER NOT NULL
);
ALTER TABLE threads ADD COLUMN IF NOT EXISTS universe TEXT NOT NULL DEFAULT 'reading';

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
-- Former tier list title, no longer set or shown
ALTER TABLE users ADD COLUMN IF NOT EXISTS list_name TEXT;
-- Secret of the first restore links, which only reconnected a browser to its list
ALTER TABLE users ADD COLUMN IF NOT EXISTS restore_token TEXT UNIQUE;

-- A copy of a tier list, brought back by its private restore link
CREATE TABLE IF NOT EXISTS backups (
  token TEXT PRIMARY KEY,
  -- Restore links outlive the account that made them
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  list_name TEXT,
  entries JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS backups_user ON backups(user_id);

-- Lets the daily cleanup drop accounts no browser can reach anymore
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_seen TIMESTAMPTZ NOT NULL DEFAULT now();

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

-- Ranking score of each title, kept up to date so pages read the few rows they show instead of scoring every title.
-- Bayesian average on the S..D scale (1-5): the seed sets the Reddit prior (prior, prior_weight) from mention counts,
-- and the trigger below folds in the tier list votes whenever a rating changes.
ALTER TABLE titles ADD COLUMN IF NOT EXISTS mention_count INTEGER NOT NULL DEFAULT 0;
ALTER TABLE titles ADD COLUMN IF NOT EXISTS votes INTEGER NOT NULL DEFAULT 0;
ALTER TABLE titles ADD COLUMN IF NOT EXISTS vote_total INTEGER NOT NULL DEFAULT 0;
ALTER TABLE titles ADD COLUMN IF NOT EXISTS prior DOUBLE PRECISION NOT NULL DEFAULT 3;
ALTER TABLE titles ADD COLUMN IF NOT EXISTS prior_weight DOUBLE PRECISION NOT NULL DEFAULT 3;
ALTER TABLE titles ADD COLUMN IF NOT EXISTS score DOUBLE PRECISION NOT NULL DEFAULT 3;
-- Ranked titles: cited on Reddit or voted on
CREATE INDEX IF NOT EXISTS titles_ranked_score ON titles (universe, score DESC) WHERE mention_count > 0 OR votes > 0;

CREATE OR REPLACE FUNCTION refresh_title_votes(tid INTEGER) RETURNS void LANGUAGE sql AS $$
  UPDATE titles t SET votes = v.votes, vote_total = v.total,
    score = (t.prior_weight * t.prior + v.total) / (t.prior_weight + v.votes)
  FROM (
    SELECT COUNT(*)::int AS votes,
      COALESCE(SUM(CASE tier WHEN 'S' THEN 5 WHEN 'A' THEN 4 WHEN 'B' THEN 3 WHEN 'C' THEN 2 ELSE 1 END), 0)::int AS total
    FROM ratings WHERE title_id = tid AND tier IS NOT NULL
  ) v
  WHERE t.id = tid
$$;

CREATE OR REPLACE FUNCTION ratings_changed() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.title_id = OLD.title_id AND NEW.tier IS NOT DISTINCT FROM OLD.tier THEN
    RETURN NULL;
  END IF;
  -- The title that lost the vote, then the one that got it (the same one for a tier change)
  IF TG_OP <> 'INSERT' THEN PERFORM refresh_title_votes(OLD.title_id); END IF;
  IF TG_OP = 'INSERT' OR (TG_OP = 'UPDATE' AND NEW.title_id <> OLD.title_id) THEN
    PERFORM refresh_title_votes(NEW.title_id);
  END IF;
  RETURN NULL;
END
$$;

CREATE OR REPLACE TRIGGER ratings_votes AFTER INSERT OR UPDATE OR DELETE ON ratings
  FOR EACH ROW EXECUTE FUNCTION ratings_changed();

-- A "basket" is a set of titles one person likes: everything a Reddit user cited, or a site user's S/A titles.
-- Grouping by Reddit author keeps a list pasted in many threads from counting many times.
-- Baskets are per universe: liking Solo Leveling and Hades says nothing about manga readers' taste in games.
-- A pair from a 3-title basket says more than one from a 70-title list: w = 1 / sqrt(basket size).
--
-- Reddit baskets only change when the seed runs, so it stores them with their weight here, indexed by title:
-- recommendations read the few baskets holding the liked titles instead of rebuilding all of them on every visit.
CREATE TABLE IF NOT EXISTS reddit_baskets (
  basket TEXT NOT NULL,
  title_id INTEGER NOT NULL REFERENCES titles(id) ON DELETE CASCADE,
  w DOUBLE PRECISION NOT NULL,
  PRIMARY KEY (basket, title_id)
);
CREATE INDEX IF NOT EXISTS reddit_baskets_title ON reddit_baskets(title_id);
-- First run after this table appeared: fill it now, so recommendations don't go empty until the seed rebuilds it
INSERT INTO reddit_baskets (basket, title_id, w)
  SELECT basket, title_id, 1 / sqrt(COUNT(*) OVER (PARTITION BY basket)) FROM (
    SELECT DISTINCT 'r:' || m.author || ':' || t.universe AS basket, m.title_id
    FROM mentions m JOIN titles t ON t.id = m.title_id
  ) d
  WHERE NOT EXISTS (SELECT 1 FROM reddit_baskets);

-- Site users' baskets follow their votes live; they are small
CREATE OR REPLACE VIEW user_baskets AS
  SELECT 'u:' || r.user_id || ':' || t.universe AS basket, r.title_id
  FROM ratings r JOIN titles t ON t.id = r.title_id WHERE r.tier IN ('S', 'A');

CREATE OR REPLACE VIEW baskets AS
  SELECT basket, title_id FROM reddit_baskets
  UNION ALL
  SELECT basket, title_id FROM user_baskets;

CREATE OR REPLACE VIEW weighted_baskets AS
  SELECT basket, title_id, w FROM reddit_baskets
  UNION ALL
  SELECT basket, title_id, 1 / sqrt(COUNT(*) OVER (PARTITION BY basket)) FROM user_baskets;

-- Messages sent from /contact. user_id only serves rate limiting and goes with the account.
CREATE TABLE IF NOT EXISTS contact_messages (
  id SERIAL PRIMARY KEY,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  subject TEXT NOT NULL CHECK (subject IN ('missing-title', 'bug', 'other')),
  email TEXT,
  body TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS contact_messages_created ON contact_messages(created_at);
-- Subjects offered by the form (src/lib/contact.ts); recreated so new ones can be added
ALTER TABLE contact_messages DROP CONSTRAINT IF EXISTS contact_messages_subject_check;
ALTER TABLE contact_messages ADD CONSTRAINT contact_messages_subject_check
  CHECK (subject IN ('missing-title', 'suggestion', 'bug', 'other'));
