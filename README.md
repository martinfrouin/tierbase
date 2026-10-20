# Panelrank

Personal manga, manhwa and manhua recommendations. The catalog comes from AniList, the initial signal from Reddit recommendation threads, and visitors refine both with their tier lists.

## Run locally

```bash
npm install
npm run db:seed   # builds data/panelrank.db from data/anilist.json + data/threads
npm run dev
```

## Data pipeline

- `npm run sync:catalog` downloads ~12k titles from AniList into `data/anilist.json` (weekly is enough). Titles AniList lacks go in `data/extra-titles.json`.
- `npm run sync:threads` finds recommendation threads on Arctic Shift (Reddit archive) and saves their comments to `data/threads/*.json.gz`. Recent threads are re-fetched for a few days to catch new comments. `--backfill-days=N` restarts from N days ago.
- `npm run db:seed` detects the titles cited in each comment and loads everything into the database. Reddit data is fully replaced on each run; users and ratings are kept.

Title detection (`scripts/lib/matcher.ts`) matches comment text against AniList titles, synonyms and generated acronyms. Community nicknames AniList doesn't know ("GED", "LMS") and false positives are fixed in `data/aliases.json`; individual comments can be ignored in `data/exclusions.json`.

## How ranking and recommendations work

- **Ranking**: Bayesian average. Each title starts with 5 virtual votes at a prior derived from its Reddit mentions (most cited ≈ 5/5, one mention ≈ 3/5); tier list votes (S=5 … D=1) progressively take over.
- **Recommendations**: item-to-item collaborative filtering. A "basket" is one Reddit comment or one user's S/A titles; two titles are similar when the same baskets contain them, normalized by popularity so blockbusters don't dominate.

## Database

libSQL: a local SQLite file by default, or Turso in production via `DATABASE_URL` and `DATABASE_AUTH_TOKEN`. Schema in `db/schema.sql`.
