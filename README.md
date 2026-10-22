# Tierbase

Personal manga, manhwa and manhua recommendations. The catalog comes from AniList, the initial signal from Reddit recommendation threads, and visitors refine both with their tier lists.

## Run locally

```bash
npm install
npm run db:up     # starts Postgres in Docker
npm run db:seed   # loads data/cache (AniList catalog + Reddit threads) into the database
npm run dev
```

## Data pipeline

- `npm run sync:catalog` downloads ~12k titles from AniList into `data/cache/anilist.json` (weekly is enough). Titles AniList lacks go in `data/extra-titles.json`; same-name adaptations (manga / light novel / one-shot) are merged at seed time.
- `npm run sync:threads` finds recommendation threads on Arctic Shift (Reddit archive) and saves their comments to `data/cache/threads/*.json.gz`. Each run catches up on new posts, re-fetches threads from the last few days, then extends history 30 days further back (up to 2 years). `--backfill-to-days=N` covers the last N days in one go.
- `npm run db:seed` detects the titles cited in each comment and loads everything into the database. Reddit data is fully replaced on each run; users and ratings are kept.

Title detection (`scripts/lib/matcher.ts`) matches comment text against AniList titles, synonyms and generated acronyms. Community nicknames AniList doesn't know ("GED", "LMS") and false positives are fixed in `data/aliases.json`; individual comments can be ignored in `data/exclusions.json`.

## How ranking and recommendations work

- **Ranking**: Bayesian average, shown out of 100. Each title starts at a prior derived from its Reddit mentions relative to its own kind (most cited manhwa and most cited manga both start at 100, one mention ≈ 50), worth half a vote per mention (3 to 25 virtual votes); tier list votes (S=5 … D=1) progressively take over.
- **Recommendations**: item-to-item collaborative filtering. A "basket" is everything one Reddit user cited (so a list pasted in ten threads counts once) or one site user's S/A titles; two titles are similar when the same baskets contain them, pairs from long lists weigh less than pairs from short comments, and scores are normalized by popularity so blockbusters don't dominate.

## Database

Postgres, in Docker locally (`docker-compose.yml`). Schema in `db/schema.sql`.

## Deployment

- **Site**: Vercel, deployed on every push to `main` by the Git integration. `DATABASE_URL` points to the VM with `?sslmode=require`.
- **Database and sync worker**: a VM running `compose.prod.yml` (Postgres with TLS required for outside connections, plus the daily sync worker). `.github/workflows/deploy-vm.yml` rsyncs the worker files and restarts the stack when they change. The VM keeps `.env` (`POSTGRES_PASSWORD`), `certs/` (self-signed TLS certificate) and `data/cache/` between deploys.

## Stats

`npm run stats` prints tier list, rating and top title counts for the database in `DATABASE_URL`. For production:

```bash
ssh <vm> 'cd ~/tierbase && docker compose -f compose.prod.yml exec -T worker npm run --silent stats'
```

Visits come from Vercel Web Analytics (cookieless), with custom events for picking favorites and copying a share link or downloading the tier list image.

## Support

If TierBase found you a good read, [buy me a coffee ☕](https://github.com/sponsors/martinfrouin).
