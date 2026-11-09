# Step 2: Games data pipeline — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Load ~11k IGDB games and game-subreddit recommendation threads into the database as a second universe, with derived genres (Roguelite, Metroidvania…), while the live site keeps showing exactly the same Reading content.

**Architecture:** `titles` and `threads` gain a `universe` column (`reading` | `games`). Game IDs are `1_000_000_000 + igdbId`. A new `sync-games` script caches IGDB data; `sync-threads` gains game subreddits; `seed-db` builds one title matcher per universe, derives game genres, and keeps Reddit and site-user baskets separate per universe. The data layer takes a universe argument that defaults to `reading`, so every existing page keeps its behavior until step 3 adds the games UI.

**Tech Stack:** Node 24 scripts (`--experimental-strip-types`), IGDB API v4 (Apicalypse queries, Twitch client-credentials auth), Postgres 17, Next.js 16.4 data layer (`src/lib/data.ts`).

**Spec:** `docs/superpowers/specs/2026-11-09-video-games-design.md`, section 1.

**Facts checked against the live IGDB API (2026-11-09):**
- Auth: `POST https://id.twitch.tv/oauth2/token?client_id=…&client_secret=…&grant_type=client_credentials` → `access_token`. Requests: `POST https://api.igdb.com/v4/games` with `Client-ID` and `Authorization: Bearer …` headers, Apicalypse body, max `limit 500`, 4 requests/s.
- `where total_rating_count >= 10 & game_type = (0,4,8,9,10) & themes != (42);` → 10,875 games (game types: 0 main, 4 standalone expansion, 8 remake, 9 remaster, 10 expanded; theme 42 = erotic).
- Keywords carry the community genres: Hades has `roguelike`, `roguelite`, `dungeon crawler`; top `roguelite` games by rating count are Hades, Dead Cells, Slay the Spire, The Binding of Isaac, Vampire Survivors, Enter the Gungeon, Risk of Rain 2.
- Cover URL: `https://images.igdb.com/igdb/image/upload/t_cover_big/<image_id>.jpg`.

**Project notes for the implementer:**
- No test framework: verification is `npm run lint`, `npm run build`, local seeds and SQL checks. Local DB: `npm run db:up`. SQL: `docker compose exec -T db psql -U tierbase -d tierbase -c '…'`.
- `IGDB_CLIENT_ID` / `IGDB_CLIENT_SECRET` are in the local `.env`. Never print them.
- Scripts can't import from `src/` (the worker image only contains `scripts/`, `db/`, `data/`).
- Use `rtk proxy <cmd>` when a command's output looks truncated or filtered (a shell hook rewrites some commands).
- Ask the user before each commit. Work on a branch: `git checkout -b feat/games-pipeline`.

---

## File map

| File | Change | Responsibility |
|---|---|---|
| `db/schema.sql` | modify | `universe` columns, per-universe slug uniqueness, per-universe baskets |
| `src/lib/universes.ts` | create | `Universe` type and parser (UI config comes in step 3) |
| `src/lib/data.ts` | modify | Universe-aware queries, `reading` by default |
| `src/app/actions.ts`, `src/app/ranking/page.tsx`, `src/app/tierlist/[shareId]/page.tsx`, `src/app/restore/[token]/confirm/page.tsx`, `src/app/sitemap.ts`, `src/app/layout.tsx` | modify | Adapt call sites, keep Reading-only output |
| `scripts/lib/subreddits.ts` | create | Subreddit list with universe, `universeOf()` |
| `scripts/lib/threads.ts` | modify | Recommendation-thread detection per universe |
| `scripts/sync-threads.ts` | modify | Use the subreddit list |
| `scripts/lib/game-genres.ts` | create | IGDB genres/themes/keywords → site genres |
| `data/game-genres.json` | create | Manual genre corrections |
| `scripts/sync-games.ts` | create | IGDB → `data/cache/igdb.json` |
| `scripts/seed-db.ts` | modify | Two catalogs, matcher per universe, universe columns |
| `scripts/worker.sh`, `compose.prod.yml`, `.env.example`, `next.config.ts`, `package.json`, `README.md` | modify | Wiring and docs |

---

### Task 0: Baseline of Reading mentions

Lets Task 7 prove Reading data is unchanged.

- [ ] **Step 1: Seed with the current code and save mention counts from Reading subreddits**

```bash
git checkout -b feat/games-pipeline
npm run db:up && npm run db:seed
docker compose exec -T db psql -U tierbase -d tierbase -At -c "
  SELECT m.title_id, COUNT(*) FROM mentions m JOIN threads th ON th.id = m.thread_id
  WHERE th.subreddit IN ('manhwa','manhwarecommendations','webtoons','manga','MangaRecommendations','Seinen','shoujo','josei','manhua')
  GROUP BY 1 ORDER BY 1" > "$SCRATCH/reading-before.tsv"
wc -l "$SCRATCH/reading-before.tsv"
```

(`$SCRATCH` = the session scratchpad directory.) Expected: several thousand lines.

---

### Task 1: Schema

**Files:** Modify `db/schema.sql`

- [ ] **Step 1: Universe on titles and threads**

After the line `CREATE INDEX IF NOT EXISTS titles_search ON titles USING gin (search gin_trgm_ops);` add:

```sql
-- 'reading' (manga, manhwa, manhua) or 'games'. A game and a manga may share a slug.
ALTER TABLE titles ADD COLUMN IF NOT EXISTS universe TEXT NOT NULL DEFAULT 'reading';
ALTER TABLE titles DROP CONSTRAINT IF EXISTS titles_slug_key;
CREATE UNIQUE INDEX IF NOT EXISTS titles_universe_slug ON titles (universe, slug);
```

After the `CREATE TABLE IF NOT EXISTS threads (…);` block add:

```sql
ALTER TABLE threads ADD COLUMN IF NOT EXISTS universe TEXT NOT NULL DEFAULT 'reading';
```

- [ ] **Step 2: Baskets per universe**

Replace the `baskets` view with:

```sql
-- A "basket" is a set of titles one person likes: everything a Reddit user cited, or a site user's S/A titles.
-- Grouping by Reddit author keeps a list pasted in many threads from counting many times.
-- Baskets are per universe: someone who likes Solo Leveling and Hades says nothing about manga readers' taste in games.
CREATE OR REPLACE VIEW baskets AS
  SELECT DISTINCT 'r:' || m.author || ':' || t.universe AS basket, m.title_id
  FROM mentions m JOIN titles t ON t.id = m.title_id
  UNION ALL
  SELECT 'u:' || r.user_id || ':' || t.universe AS basket, r.title_id
  FROM ratings r JOIN titles t ON t.id = r.title_id WHERE r.tier IN ('S', 'A');
```

- [ ] **Step 3: Apply twice (idempotence)**

Run: `npm run db:seed && npm run db:seed`
Expected: both succeed. `\d titles` shows `universe` and index `titles_universe_slug`, no `titles_slug_key`.

- [ ] **Step 4: Commit (after asking)** — `git commit -am "Add a universe to titles and threads"`

---

### Task 2: Universe-aware data layer (Reading by default)

**Files:**
- Create: `src/lib/universes.ts`
- Modify: `src/lib/data.ts`, `src/app/actions.ts`, `src/app/ranking/page.tsx`, `src/app/tierlist/[shareId]/page.tsx`, `src/app/restore/[token]/confirm/page.tsx`, `src/app/sitemap.ts`, `src/app/layout.tsx`

- [ ] **Step 1: `src/lib/universes.ts`**

```ts
export type Universe = "reading" | "games";

export const UNIVERSES: Universe[] = ["reading", "games"];

export function parseUniverse(value: string | null | undefined): Universe | null {
  return UNIVERSES.includes(value as Universe) ? (value as Universe) : null;
}
```

- [ ] **Step 2: `src/lib/data.ts`**

1. Import and re-export: `import { type Universe } from "@/lib/universes";` and add `type Universe` to the existing `export { KINDS, type Kind };` line.
2. Add after `TIER_WEIGHT`:

```ts
// Must match the baskets view in db/schema.sql
export function userBasket(userId: string, universe: Universe): string {
  return `u:${userId}:${universe}`;
}
```

3. `getRanking` takes a filter object:

```ts
export interface RankingFilter {
  universe?: Universe;
  kind?: Kind;
  genre?: string;
}

export async function getRanking({ universe = "reading", kind, genre }: RankingFilter = {}): Promise<RankedTitle[]> {
```

and its `WHERE` becomes:

```sql
    WHERE (m.n > 0 OR r.votes > 0) AND t.universe = ${universe}
      AND (${universe}::text <> 'reading' OR t.kind IN ${sql(KINDS.map((k) => k.value))})
      AND (${kind ?? null}::text IS NULL OR t.kind = ${kind ?? null})
      AND (${genre ?? null}::text IS NULL OR t.genres @> jsonb_build_array(${genre ?? null}::text))
```

4. `getTitle(slug: string, universe: Universe = "reading")`: query `… FROM titles t WHERE slug = ${slug} AND universe = ${universe}` and call `getRanking({ universe })`.
5. `searchTitles(query, limit = 24, universes: Universe[] = ["reading"])`: add `AND universe IN ${sql(universes)}`.
6. `getLibrary(userId: string, universe: Universe | null = "reading")` (`null` = every universe): add `AND (${universe}::text IS NULL OR t.universe = ${universe})`.
7. `personalRecommendations(userId: string, limit = 20, universe: Universe = "reading")`: `getLibrary(userId, universe)` and `skipBasket: userBasket(userId, universe)`.

- [ ] **Step 3: Call sites**

- `src/app/ranking/page.tsx:42`: `getRanking(kind)` → `getRanking({ kind: kind ?? undefined })` (adapt to the variable's actual type).
- `src/app/tierlist/[shareId]/page.tsx`: `skipBasket: \`u:${owner.id}\`` → `skipBasket: userBasket(owner.id, "reading")` (import `userBasket`).
- `src/app/restore/[token]/confirm/page.tsx:20`: `getLibrary(current)` → `getLibrary(current, null)` (counts the whole list the restore would replace).
- `src/app/actions.ts` `clearTiers`: add `AND t.universe = 'reading'` to the `DELETE` (the games tier list gets its own clear in step 3).
- `src/app/sitemap.ts`: add `AND universe = 'reading'` to the titles query.
- `src/app/layout.tsx` `Stats`: count Reading only:

```sql
    SELECT (SELECT COUNT(DISTINCT m.comment_id)::int FROM mentions m JOIN threads th ON th.id = m.thread_id
            WHERE th.universe = 'reading') AS comments,
           (SELECT COUNT(*)::int FROM threads WHERE universe = 'reading') AS threads
```

- [ ] **Step 4: Verify**

Run: `npm run lint && npm run build` → success. `grep -rn "u:\${" src` → only `userBasket`.

- [ ] **Step 5: Commit (after asking)** — `git commit -am "Scope data queries to a universe, Reading by default"` (add `src/lib/universes.ts`).

---

### Task 3: Game subreddits and thread detection

**Files:**
- Create: `scripts/lib/subreddits.ts`
- Modify: `scripts/lib/threads.ts`, `scripts/sync-threads.ts`

- [ ] **Step 1: `scripts/lib/subreddits.ts`**

```ts
export type Universe = "reading" | "games";

// Sources per kind, so manga, manhwa and manhua each get comparable coverage.
// Manhwa subreddits are far busier: the manga side gets the smaller demographic communities too.
export const SUBREDDITS: { name: string; universe: Universe }[] = [
  { name: "manhwa", universe: "reading" },
  { name: "manhwarecommendations", universe: "reading" },
  { name: "webtoons", universe: "reading" },
  { name: "manga", universe: "reading" },
  { name: "MangaRecommendations", universe: "reading" },
  { name: "Seinen", universe: "reading" },
  { name: "shoujo", universe: "reading" },
  { name: "josei", universe: "reading" },
  { name: "manhua", universe: "reading" },
  { name: "roguelites", universe: "games" },
  { name: "roguelikes", universe: "games" },
  { name: "patientgamers", universe: "games" },
  { name: "gamingsuggestions", universe: "games" },
  { name: "ShouldIbuythisgame", universe: "games" },
  { name: "metroidvania", universe: "games" },
  { name: "JRPG", universe: "games" },
  { name: "CozyGamers", universe: "games" },
];

export function universeOf(subreddit: string): Universe {
  return SUBREDDITS.find((s) => s.name.toLowerCase() === subreddit.toLowerCase())?.universe ?? "reading";
}
```

- [ ] **Step 2: `scripts/lib/threads.ts`**

Replace `MEDIUM`, `ASKING_PATTERNS` and `OFF_TOPIC` with per-universe versions and give `isRecommendationThread` a universe:

```ts
import type { Universe } from "./subreddits.ts";

const MEDIUM: Record<Universe, string> = {
  reading: String.raw`(manhwas?|mangas?|manhuas?|webtoons?|comics?|series|reads?|titles?|stories|story|ones?)`,
  games: String.raw`(games?|rogue-?(lites?|likes?)|metroidvanias?|j?rpgs?|deck-?builders?|souls-?likes?|series|titles?|ones?)`,
};

const askingPatterns = (universe: Universe) => [
  new RegExp(String.raw`\b(best|favou?rites?|goats?|top ?\d+|all[- ]?time|underrated|hidden gems?|must[- ]?(reads?|plays?)|peak)\b.{0,50}\b${MEDIUM[universe]}\b`, "i"),
  /\b(recommend\w*|recs?|suggest\w*|looking for|similar to|what (should|to) i (read|play)|need (something|a new|more))\b/i,
];
const ASKING_PATTERNS: Record<Universe, RegExp[]> = { reading: askingPatterns("reading"), games: askingPatterns("games") };

const OFF_TOPIC =
  /\b(guess|describe|badly|hair|beauty|husbands?|wives|waifus?|characters?|protagonists?|female leads?|male leads?|villains?|art ?style|cover|ships?|couples?|scene|panel|chapter|meme)\b/i;
// Gameplay help posts: "best build for…", "seed?", "controller settings"
const GAMES_OFF_TOPIC = /\b(builds?|seeds?|patch(es)?|achievements?|speedruns?|save ?files?|controllers?|settings|fps|crash(es|ing)?|mods?)\b/i;
```

and in `isRecommendationThread(post, universe: Universe = "reading")`:
- `if (OFF_TOPIC.test(post.title) || (universe === "games" && GAMES_OFF_TOPIC.test(post.title))) return false;`
- `ASKING_PATTERNS[universe].some(…)` instead of `ASKING_PATTERNS.some(…)`.

Note: the reading `ASKING_PATTERNS` change from `what (should|to) i read` to `what (should|to) i (read|play)` and `must[- ]?reads?` to `must[- ]?(reads?|plays?)` is harmless for Reading.

- [ ] **Step 3: `scripts/sync-threads.ts`**

- Delete the local `SUBREDDITS` array and its comment; `import { SUBREDDITS, universeOf } from "./lib/subreddits.ts";`.
- In `scan`: `found.push(...data.filter((p) => isRecommendationThread(p, universeOf(p.subreddit))));`
- Both loops: iterate `SUBREDDITS.map((s) => s.name)` (define `const NAMES = SUBREDDITS.map((s) => s.name);` and use it everywhere the old array was used, including `Math.min(...NAMES.map(...))` and `NAMES.filter(...)`).

New subreddits start at "now" and the backward pass extends them to the history of the others in one run (`stopAt` = oldest existing minus 30 days). On production (2 years of history) the first run is long (hours) but resumable: state is saved after each week block.

- [ ] **Step 4: Lint** — `npm run lint` → no error.

- [ ] **Step 5: Commit (after asking)** — `git commit -am "Collect recommendation threads from game subreddits"` (add `scripts/lib/subreddits.ts`).

---

### Task 4: Derived game genres

**Files:**
- Create: `scripts/lib/game-genres.ts`
- Create: `data/game-genres.json`

- [ ] **Step 1: `scripts/lib/game-genres.ts`**

```ts
export interface IgdbTags {
  genres: string[];
  themes: string[];
  keywords: string[];
}

interface Rule {
  genre: string;
  genres?: string[];
  themes?: string[];
  keywords?: string[];
}

// Site genres, in display order. Players don't separate roguelikes from roguelites in tier lists, so one genre covers both.
export const GAME_GENRE_RULES: Rule[] = [
  { genre: "Roguelite", keywords: ["roguelite", "roguelike", "rogue-lite", "rogue-like", "roguelike deckbuilder"] },
  { genre: "Deckbuilder", keywords: ["deckbuilding", "deck building", "deck-building", "deckbuilder", "roguelike deckbuilder"] },
  { genre: "Metroidvania", keywords: ["metroidvania"] },
  { genre: "Soulslike", keywords: ["soulslike", "souls-like"] },
  { genre: "RPG", genres: ["Role-playing (RPG)"] },
  { genre: "JRPG", keywords: ["jrpg"] },
  { genre: "Strategy", genres: ["Strategy", "Real Time Strategy (RTS)", "Turn-based strategy (TBS)", "Tactical"] },
  { genre: "Shooter", genres: ["Shooter"] },
  { genre: "Platformer", genres: ["Platform"] },
  { genre: "Puzzle", genres: ["Puzzle"] },
  { genre: "Adventure", genres: ["Adventure", "Point-and-click"] },
  { genre: "Fighting", genres: ["Fighting"] },
  { genre: "Racing", genres: ["Racing"] },
  { genre: "Sports", genres: ["Sport"] },
  { genre: "Simulation", genres: ["Simulator"] },
  { genre: "Visual novel", genres: ["Visual Novel"] },
  { genre: "Survival", themes: ["Survival"] },
  { genre: "Horror", themes: ["Horror"] },
  { genre: "Open world", themes: ["Open world"] },
  { genre: "Cozy", keywords: ["cozy", "wholesome"] },
  { genre: "Indie", genres: ["Indie"] },
];

const lower = (list: string[]) => new Set(list.map((s) => s.toLowerCase()));

export function deriveGenres(tags: IgdbTags, corrections?: { add?: string[]; remove?: string[] }): string[] {
  const genres = lower(tags.genres);
  const themes = lower(tags.themes);
  const keywords = lower(tags.keywords);
  const found = GAME_GENRE_RULES.filter(
    (r) =>
      r.genres?.some((g) => genres.has(g.toLowerCase())) ||
      r.themes?.some((t) => themes.has(t.toLowerCase())) ||
      r.keywords?.some((k) => keywords.has(k)),
  ).map((r) => r.genre);
  const removed = new Set(corrections?.remove ?? []);
  return [...new Set([...found, ...(corrections?.add ?? [])])].filter((g) => !removed.has(g));
}
```

- [ ] **Step 2: `data/game-genres.json`**

```json
{
  "add": {},
  "remove": {}
}
```

Keys are catalog IDs (`1000000000 + igdbId`), values are lists of site genres. Filled in Task 8.

- [ ] **Step 3: Commit (after asking)** — `git add scripts/lib/game-genres.ts data/game-genres.json && git commit -m "Derive site genres from IGDB tags"`

---

### Task 5: `sync-games`

**Files:**
- Create: `scripts/sync-games.ts`
- Modify: `package.json`, `.env.example`, `next.config.ts`

- [ ] **Step 1: `scripts/sync-games.ts`**

```ts
import { mkdirSync, renameSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fetchJson } from "./lib/http.ts";

const ROOT = join(import.meta.dirname, "..");
const OUT = join(ROOT, "data/cache/igdb.json");
// Keeps game IDs clear of AniList's in the shared titles table
const GAME_ID_OFFSET = 1_000_000_000;
// ~11k games: what players actually cite, without the long tail that only adds false matches
const MIN_RATINGS = 10;
const PAGE = 500;
// Main games, standalone expansions, remakes, remasters, expanded games (no DLC, bundles, ports, mods)
const GAME_TYPES = [0, 4, 8, 9, 10];
const EROTIC_THEME = 42;

const { IGDB_CLIENT_ID: clientId, IGDB_CLIENT_SECRET: clientSecret } = process.env;
if (!clientId || !clientSecret) {
  console.error("Set IGDB_CLIENT_ID and IGDB_CLIENT_SECRET (Twitch developer console)");
  process.exit(1);
}

const auth = await fetchJson<{ access_token: string }>(
  `https://id.twitch.tv/oauth2/token?client_id=${clientId}&client_secret=${clientSecret}&grant_type=client_credentials`,
  { method: "POST" },
);

interface Game {
  id: number;
  name: string;
  alternative_names?: { name: string }[];
  summary?: string;
  genres?: { name: string }[];
  themes?: { name: string }[];
  keywords?: { name: string }[];
  cover?: { image_id: string };
  first_release_date?: number;
  total_rating_count?: number;
  url: string;
}

const names = (list?: { name: string }[]) => (list ?? []).map((x) => x.name);

const catalog = [];
// Sorted by id so pages never shift while paginating
for (let offset = 0; ; offset += PAGE) {
  const games = await fetchJson<Game[]>(
    "https://api.igdb.com/v4/games",
    {
      method: "POST",
      headers: { "Client-ID": clientId, Authorization: `Bearer ${auth.access_token}`, "Content-Type": "text/plain" },
      body: `fields name,alternative_names.name,summary,genres.name,themes.name,keywords.name,cover.image_id,first_release_date,total_rating_count,url;
        where total_rating_count >= ${MIN_RATINGS} & game_type = (${GAME_TYPES.join(",")}) & themes != (${EROTIC_THEME});
        sort id asc; limit ${PAGE}; offset ${offset};`,
    },
    { spacingMs: 300 },
  );
  for (const g of games) {
    catalog.push({
      id: GAME_ID_OFFSET + g.id,
      universe: "games",
      name: g.name.trim(),
      romaji: null,
      synonyms: names(g.alternative_names),
      description: g.summary ?? null,
      origin: "",
      format: "GAME",
      status: null,
      genres: [],
      igdb: { genres: names(g.genres), themes: names(g.themes), keywords: names(g.keywords) },
      released: g.first_release_date ? new Date(g.first_release_date * 1000).getUTCFullYear() : null,
      popularity: g.total_rating_count ?? 0,
      url: g.url,
      cover: g.cover ? `https://images.igdb.com/igdb/image/upload/t_cover_big/${g.cover.image_id}.jpg` : "",
    });
  }
  console.log(`offset ${offset}: ${catalog.length} games`);
  if (games.length < PAGE) break;
}

// Written only once complete: a failed run keeps the previous catalog
mkdirSync(join(ROOT, "data/cache"), { recursive: true });
writeFileSync(`${OUT}.tmp`, JSON.stringify(catalog));
renameSync(`${OUT}.tmp`, OUT);
console.log(`Saved ${catalog.length} games`);
```

- [ ] **Step 2: npm script** — in `package.json` after `sync:threads`:

```json
    "sync:games": "node --env-file-if-exists=.env --experimental-strip-types --no-warnings scripts/sync-games.ts",
```

- [ ] **Step 3: `.env.example`** — append:

```
# Twitch developer console (dev.twitch.tv/console/apps), used by npm run sync:games
IGDB_CLIENT_ID=
IGDB_CLIENT_SECRET=
```

- [ ] **Step 4: `next.config.ts`** — `remotePatterns` gets `{ protocol: "https", hostname: "images.igdb.com" }`.

- [ ] **Step 5: Run it**

Run: `npm run sync:games`
Expected: ~22 `offset …` lines, then `Saved 10xxx games` (about 10–15 s). Check: `node -e 'const c=require("./data/cache/igdb.json");console.log(c.length, c.find(g=>g.name==="Hades"&&g.popularity>100))'` shows Hades with its `igdb.keywords` containing `roguelite`.

- [ ] **Step 6: Commit (after asking)** — `git add scripts/sync-games.ts package.json .env.example next.config.ts && git commit -m "Add IGDB games sync"`

---

### Task 6: Seed both universes

**Files:** Modify `scripts/seed-db.ts`

- [ ] **Step 1: Types and catalogs**

- Imports: add `existsSync` from `node:fs`, `deriveGenres, type IgdbTags` from `./lib/game-genres.ts`, `universeOf, type Universe` from `./lib/subreddits.ts`.
- `CatalogEntry` gains `universe?: Universe;` and `igdb?: IgdbTags;`; `status` becomes `string | null`.
- Reading catalog: rename the current `catalog` IIFE result to `readingCatalog` (logic unchanged, entries get `universe: "reading"` in the final `map`).
- Games catalog:

```ts
// Missing until the first `npm run sync:games`: games are then left as they are in the database
const GAMES_CACHE = "data/cache/igdb.json";
const hasGames = existsSync(join(ROOT, GAMES_CACHE));
const genreCorrections = readJson<{ add: Record<string, string[]>; remove: Record<string, string[]> }>("data/game-genres.json");
const gamesCatalog: CatalogEntry[] = (hasGames ? readJson<CatalogEntry[]>(GAMES_CACHE) : []).map((g) => ({
  ...g,
  universe: "games",
  genres: deriveGenres(g.igdb!, { add: genreCorrections.add[g.id], remove: genreCorrections.remove[g.id] }),
}));
const catalog = [...readingCatalog, ...gamesCatalog];
```

- [ ] **Step 2: One matcher per universe**

Replace `const matcher = new TitleMatcher(catalog, words, readJson("data/aliases.json"));` with:

```ts
const aliases = readJson<{ add: Record<string, string[]>; block: string[] }>("data/aliases.json");
// Each matcher only knows its own titles, so "Hades" in r/roguelites never lands on a manga
function matcherFor(titles: CatalogEntry[]) {
  const ids = new Set(titles.map((t) => String(t.id)));
  const add = Object.fromEntries(Object.entries(aliases.add).filter(([id]) => ids.has(id)));
  return new TitleMatcher(titles, words, { ...aliases, add });
}
const matchers: Record<Universe, TitleMatcher> = { reading: matcherFor(readingCatalog), games: matcherFor(gamesCatalog) };
```

- [ ] **Step 3: Names, kind, slugs, rows**

- `displayName(t)`: first line `if (t.universe === "games") return t.name;`
- `kind(t)`: first line `if (t.universe === "games") return "game";`
- Slugs per universe:

```ts
const existingSlugs = new Map((await sql`SELECT id, slug FROM titles`).map((r) => [Number(r.id), String(r.slug)]));
const slugKey = (t: CatalogEntry, slug: string) => `${t.universe}:${slug}`;
const usedSlugs = new Set(
  (await sql`SELECT universe, slug FROM titles`).map((r) => `${r.universe}:${r.slug}`),
);
```

and in the row `map`, replace the collision handling with:

```ts
      // Games suffix with the IGDB id, not the offset one, so URLs stay short
      const shortId = t.universe === "games" ? t.id - 1_000_000_000 : t.id;
      if (usedSlugs.has(slugKey(t, slug))) slug = `${slug}-${shortId}`;
      usedSlugs.add(slugKey(t, slug));
```
- Row: add `universe: t.universe!`; `ON CONFLICT … DO UPDATE SET` adds `universe = excluded.universe`.
- `cleanDescription` is fine for IGDB summaries (plain text passes through).

- [ ] **Step 4: Threads**

In the thread loop:

```ts
  const universe = universeOf(post.subreddit);
  if (!isRecommendationThread(post, universe)) continue;
  …
    for (const titleId of matchers[universe].match(c.body)) {
```

and `threadRows.push({ …, universe })` (add `universe: Universe` to the `threadRows` element type).

- [ ] **Step 5: Removal of titles that left the catalog**

Replace the `DELETE FROM titles WHERE id <> ALL(…)` line with:

```ts
  // Only universes whose catalog was loaded: a missing games cache must not wipe the games
  const loaded: Universe[] = hasGames ? ["reading", "games"] : ["reading"];
  await tx`
    DELETE FROM titles WHERE universe IN ${tx(loaded)} AND id <> ALL(${catalog.map((t) => t.id)}::int[])
      AND id NOT IN (SELECT title_id FROM ratings)
  `;
```

- [ ] **Step 6: Final log** — print counts per universe: `` `${readingCatalog.length} reading titles (${mergedInto.size} duplicates merged), ${gamesCatalog.length} games, …` ``.

- [ ] **Step 7: Lint** — `npm run lint` → no error.

---

### Task 7: Reading is unchanged

- [ ] **Step 1: Seed without game threads first**

Move the games cache aside so this seed only proves the refactor: `mv data/cache/igdb.json "$SCRATCH/"` then `npm run db:seed`.

- [ ] **Step 2: Compare with the baseline**

```bash
docker compose exec -T db psql -U tierbase -d tierbase -At -c "
  SELECT m.title_id, COUNT(*) FROM mentions m JOIN threads th ON th.id = m.thread_id
  WHERE th.subreddit IN ('manhwa','manhwarecommendations','webtoons','manga','MangaRecommendations','Seinen','shoujo','josei','manhua')
  GROUP BY 1 ORDER BY 1" | diff "$SCRATCH/reading-before.tsv" - && echo IDENTICAL
```

Expected: `IDENTICAL`. Any difference is a bug in Tasks 3 or 6 (the ASKING pattern change can only add threads matching "what should I play" / "must play", which is unlikely in manga subreddits; inspect them before accepting).

- [ ] **Step 3: Restore the cache** — `mv "$SCRATCH/igdb.json" data/cache/`

- [ ] **Step 4: Commit (after asking)** — `git commit -am "Seed games next to reading titles, one matcher per universe"`

---

### Task 8: Game threads, matching quality, genres

- [ ] **Step 1: Fetch game threads (local history: ~110 days)**

Run: `npm run sync:threads` (long: it backfills the 8 new subreddits to the local history depth; let it run in the background). Then `npm run db:seed`.

- [ ] **Step 2: Inspect**

```sql
-- Volume
SELECT universe, COUNT(*) FROM threads GROUP BY 1;
-- Most cited games: should look like r/roguelites + r/patientgamers favorites
SELECT t.name, COUNT(*) FROM mentions m JOIN titles t ON t.id = m.title_id
WHERE t.universe = 'games' GROUP BY 1 ORDER BY 2 DESC LIMIT 50;
-- Genre coverage
SELECT g, COUNT(*) FROM titles, jsonb_array_elements_text(genres) g WHERE universe = 'games' GROUP BY 1 ORDER BY 2 DESC;
-- Top roguelites
SELECT name, popularity FROM titles WHERE universe = 'games' AND genres @> '["Roguelite"]' ORDER BY popularity DESC LIMIT 30;
```

- [ ] **Step 3: Spot-check false positives**

For suspicious entries in the top 50 (ordinary words: Control, Inside, Prey, Journey, Celeste, Limbo, Outer Wilds, It Takes Two…), read 10 mentions: `SELECT left(body, 200) FROM mentions m JOIN titles t ON t.id = m.title_id WHERE t.name = 'Control' LIMIT 10;`. Fix with `data/aliases.json` (`block` for bad aliases; `add` with catalog IDs for nicknames: `boi`, `tboi`, `sts`, `ror2`, `etg`/`gungeon`, `botw`, `totk`, `rdr2`, `hk`, `ds3`…). Re-seed, re-check. Keep fixes for the top ~50 only (YAGNI).

- [ ] **Step 4: Genre corrections**

If well-known roguelites are missing from the Roguelite list (Balatro, Hades II, Inscryption, Into the Breach, FTL, Spelunky 2, Noita, Darkest Dungeon…), add them in `data/game-genres.json` `add`; remove obvious mistakes with `remove`. Re-seed.

- [ ] **Step 5: The site still only shows Reading**

`npm run dev`, then: ranking has no games; header search `hades` returns no game; `/title/hades` is 404 (or a manga called Hades); `/sitemap.xml` has no game slug; footer counts are unchanged from before the step.

- [ ] **Step 6: Commit (after asking)** — `git commit -am "Add game aliases and genre corrections"`

---

### Task 9: Worker, deployment, docs

**Files:** `scripts/worker.sh`, `compose.prod.yml`, `README.md`

- [ ] **Step 1: `scripts/worker.sh`** — after the `sync:catalog` block, inside the loop:

```sh
  if [ -n "$IGDB_CLIENT_ID" ] && { [ "$(date -u +%u)" = "1" ] || [ ! -f data/cache/igdb.json ]; }; then
    npm run sync:games
  fi
```

and update the header comment to "Daily Reddit sync, weekly AniList and IGDB refresh, then reload the database".

- [ ] **Step 2: `compose.prod.yml`** — worker `environment`:

```yaml
      IGDB_CLIENT_ID: ${IGDB_CLIENT_ID:-}
      IGDB_CLIENT_SECRET: ${IGDB_CLIENT_SECRET:-}
```

- [ ] **Step 3: `README.md`**

- Intro: manga, manhwa, manhua **and video games**; the game catalog comes from IGDB.
- Data pipeline: `npm run sync:games` (needs `IGDB_CLIENT_ID`/`IGDB_CLIENT_SECRET`, weekly), game subreddits in `scripts/lib/subreddits.ts`, derived genres in `scripts/lib/game-genres.ts` with corrections in `data/game-genres.json`, game IDs offset by 1,000,000,000 (so aliases use that ID).
- Deployment: the VM `.env` also holds `IGDB_CLIENT_ID` and `IGDB_CLIENT_SECRET`.

- [ ] **Step 4: Final checks** — `npm run lint && npm run build` → success; `docker compose -f compose.prod.yml config >/dev/null` with dummy env (`POSTGRES_PASSWORD=x`) → valid.

- [ ] **Step 5: Commit (after asking)** — `git commit -am "Run the games sync in the worker"`

- [ ] **Step 6: Deployment note for the user** — after merging, the VM worker restarts: seed (schema migration), then the first loop runs `sync:games` (no cache yet), `sync:threads` (long first run: backfills 8 game subreddits up to 2 years, resumable), seed. The site shows nothing new until step 3.
