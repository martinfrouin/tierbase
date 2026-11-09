# Video games, header search and contact form

Date: 2026-11-09

## Goal

TierBase is no longer limited to manga, manhwa and manhua. Video games become a second **universe**, with their own catalog, Reddit signal, ranking, tier list and recommendations. Players frequently share genre tier lists (roguelites especially), so genre filtering is a first-class feature.

Two smaller additions ship alongside: a search button in the header, and a contact form.

## Decisions

| Topic | Decision |
|---|---|
| Coexistence | Separate universes: **Reading** (existing) and **Games**. Ranking, tier list and recommendations (shown on each universe's home page) never mix universes. |
| Games scope | All popular games (~10k), one games tier list per user, genre filter (Roguelite, RPG, Metroidvania…) on ranking and tier list. |
| Catalog source | IGDB (Twitch developer credentials: `IGDB_CLIENT_ID`, `IGDB_CLIENT_SECRET`). |
| Data model | Same tables, new `universe` column. Game IDs offset by `1_000_000_000` to avoid colliding with AniList IDs. |
| Accounts | Same cookie and account. The existing tier list becomes the Reading tier list; the Games tier list starts empty. |
| Header search | Searches both universes at once, results badged 🎮 / 📖. |
| Contact | Stored in the database, no external service in v1. |

## 1. Data and pipeline

### Schema (`db/schema.sql`, additive and idempotent)

- `titles.universe TEXT NOT NULL DEFAULT 'reading'` (`'reading' | 'games'`).
- Slug uniqueness moves from `slug` to `(universe, slug)` so a game and a manga can both be called `hades`. Drop `titles_slug_key`, add a unique index on `(universe, slug)`.
- `threads.universe TEXT NOT NULL DEFAULT 'reading'`.
- `contact_messages (id SERIAL, user_id UUID NULL, email TEXT NULL, subject TEXT NOT NULL, body TEXT NOT NULL, created_at TIMESTAMPTZ DEFAULT now())`.
- Games: `kind = 'game'`, `origin` = developer country or `''`, `genres` = normalized IGDB genres plus derived genres (below), `romaji`/`native` NULL, `url` = IGDB page.

### `scripts/sync-games.ts` (new)

- Authenticates with Twitch client credentials, pages through IGDB `/games` sorted by popularity (IGDB `popularity_primitives`), keeping main games only (no DLC, bundles, editions, ports; no adult themes), up to ~10k.
- Fetches name, alternative names, summary, genres, themes, keywords, cover, first release date, developer country, IGDB URL.
- Writes `data/cache/igdb.json` in the same `CatalogEntry` shape the seed already reads (plus `universe: "games"`). Writes only on success: a failed run leaves the previous cache untouched.
- `npm run sync:games`; the worker runs it weekly next to `sync:catalog`.

### Derived genres

IGDB has no "Roguelite" genre. `scripts/lib/game-genres.ts` maps IGDB genres, themes and keywords to a fixed list of site genres (Roguelite, Roguelike, Deckbuilder, Metroidvania, Soulslike, RPG, JRPG, Strategy, Shooter, Platformer, Puzzle, Survival, Cozy, Horror, Indie…). Manual corrections live in `data/game-genres.json` (`{ add: { [gameId]: string[] }, remove: { [gameId]: string[] } }`), like `aliases.json`.

### Reddit signal (`scripts/sync-threads.ts`, `scripts/lib/threads.ts`)

- `SUBREDDITS` becomes `{ name, universe }[]`. Games: `roguelites`, `roguelikes`, `patientgamers`, `gamingsuggestions`, `ShouldIbuythisgame`, `metroidvania`, `JRPG`, `CozyGamers`. History state per subreddit is unchanged.
- `isRecommendationThread(post, universe)`: the `MEDIUM` vocabulary gains `games?`, `roguelites?`, `roguelikes?`, `metroidvanias?`, `rpgs?`; "what should I play" joins the asking patterns. Off-topic words are reviewed for games (e.g. `build`, `seed`, `run` posts are not recommendation threads).
- Saved thread files record their universe (derived from the subreddit when absent, so existing cache files keep working).

### Seeding (`scripts/seed-db.ts`)

- Loads both catalogs. The same-name merge and the `kind()` filter apply to Reading only; games get `kind = 'game'` and IDs `1_000_000_000 + igdbId`.
- One `TitleMatcher` per universe; a thread is only matched against its own universe's catalog, so "Hades" in r/roguelites can't hit a manga. `data/aliases.json` is shared (IDs are unambiguous); add game nicknames there (`boi`, `sts`, `ror2`, `gungeon`…).
- The "titles that left the catalog" cleanup considers both catalogs, so a missing `igdb.json` never deletes games: if the games cache is absent, game rows are left as they are.
- Slugs stay stable; uniqueness is checked per universe.

### Data layer (`src/lib/data.ts`)

- `getRanking(universe, filter?)` where `filter` is a kind (Reading) or a genre (Games). The "reference halfway between kind top and overall top" logic stays for Reading; Games use a single reference.
- `getTitle(universe, slug)`, `getLibrary(userId, universe)`, `personalRecommendations(userId, universe)`, `similarTitles` (universe from the seed title).
- `recommend` only returns candidates from the seed titles' universe.
- `baskets` view: site-user baskets become `'u:' || user_id || ':' || universe`, so a user's S/A manga and S/A games never form one basket. `skipBasket` follows.
- `searchTitles` returns `universe` on each card. `TitleCard` gains `universe`.
- `clearTiers(universe, kind|genre)` only clears that universe.
- Backups and restore are untouched: they already store every rating by title ID, both universes included.

## 2. UI and navigation

### `src/lib/universes.ts` (new)

One config object per universe: base path (`''` / `'/games'`), title path (`/title` / `/game`), wording (read/play, "Want to read"/"Want to play", "Find your next read"/"Find your next game", "readers"/"players"), filter options (kinds vs genres), catalog source credit (AniList / IGDB). Components receive this config instead of hard-coded strings: `TierBoard`, `RateButtons`, `FavoritesPicker`, `TierListNudge`, `Synopsis`, `tier-image.tsx`, OpenGraph images.

### Routes

Reading keeps its current URLs (SEO and shared links). Games mirror them:

- `/games` (home with recommendations), `/games/ranking?genre=roguelite`, `/games/tierlist`, `/games/tierlist/[shareId]` (+ image and OG routes)
- `/game/[slug]` (+ OG image)
- `/games/ranking/[genre]`: static, indexable "Best roguelites" style pages for the main genres, in the sitemap

Existing page files become thin wrappers around shared page components that take a universe.

### Header

- Logo · **Reading / Games** switch · Ranking · Tier list (links follow the current universe, inferred from the path).
- **Search button** (magnifier): opens an input with instant results from both universes, each badged 🎮 / 📖 and linking to its page. Full-screen overlay on mobile. Uses the existing `search` action, debounced, ignoring stale responses (same pattern as `TierBoard`). Escape closes it, arrow keys + Enter navigate results.

### Contact form

- `/contact`, linked in the footer next to Legal and Privacy.
- Fields: subject (missing title suggestion, bug, other), message (required, ≤ 4000 chars), email (optional, for a reply).
- Server Action inserts into `contact_messages`. Honeypot field; at most 5 messages per hour per user cookie (counted in the table). Clear success / error messages.
- `npm run messages` prints the latest messages. Email notification (via a Vercel Marketplace provider such as Resend) is out of scope for v1.
- Privacy page mentions the stored email and message.

## 3. Errors and verification

- IGDB down or credentials missing: `sync-games` exits non-zero without writing; the worker continues with the Reddit sync and seed using the last cache.
- No test framework in the project. Each step is verified with `npm run lint`, `npm run build`, a full local seed, and manual checks:
  - Matching on tricky game names (Hades, Control, Inside, Celeste, Balatro, Dead Cells) in a sample of r/roguelites threads.
  - Reading ranking and recommendations unchanged after the migration.
  - Browser walkthrough of both universes, header search and contact form, desktop and mobile.

## 4. Delivery steps

Each step can be deployed on its own.

1. **Header search + contact form**: independent of games.
2. **Schema + games pipeline**: migration, `sync-games`, derived genres, game subreddits, seed by universe, data layer filtered by universe (Reading behaves exactly as before).
3. **Games UI**: universe config, shared page components, `/games/*` and `/game/*` routes, header switch, universe-aware search badges.
4. **Genre SEO pages + sitemap**.

## Out of scope

- Separate tier lists per genre.
- Cross-universe recommendations.
- Steam tag enrichment (possible later via IGDB's Steam IDs if derived genres are not good enough).
- Email notification for contact messages.
- Other universes (anime, films…), though the universe config makes them easier later.
