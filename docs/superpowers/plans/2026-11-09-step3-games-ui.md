# Step 3: Games UI — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show the Games universe on the site — home with recommendations, ranking with genre filters, tier list, shared tier lists, game pages — next to the unchanged Reading pages, with a Reading/Games switch in the header and a header search across both.

**Architecture:** Every page body moves into a shared "view" (`src/views/*.tsx`) that takes a `universe`. Reading routes keep their URLs and render the view with `"reading"`; new routes under `/games/*` and `/game/[slug]` render it with `"games"`. All wording, paths and filters come from one config object per universe in `src/lib/universes.ts`. Title cards carry their universe so any link can be built with `titleHref()`.

**Tech Stack:** Next.js 16.4 App Router (Cache Components, PPR), React 19.3, Postgres.

**Spec:** `docs/superpowers/specs/2026-11-09-video-games-design.md`, section 2. Step 4 (genre SEO pages) is folded in here: genre rankings use `?genre=` with their own title and canonical URL, like Reading kinds today, and go in the sitemap.

**Project notes:**
- Read `node_modules/next/dist/docs/` for anything about layouts metadata, `generateMetadata`, route handlers or `opengraph-image` before changing them (AGENTS.md).
- Verification: `npm run lint`, `npm run build`, browser walkthrough on the dev server (port 3001 locally, 3000 is taken). The local DB already holds games and 30 days of game threads.
- Reading must look and behave exactly as before, apart from the header switch and search badges.
- Branch `feat/games-ui`; ask before each commit.

---

## File map

| File | Change | Responsibility |
|---|---|---|
| `src/lib/universes.ts` | extend | `UniverseConfig` per universe: paths, wording, filters, source credit; `universeOfPath()`, `titleHref()` |
| `src/lib/game-genres.ts` | create | Site game genres for the UI: name, slug, plural ("roguelites") |
| `src/lib/kinds.ts` | modify | `Kind` gains `"game"`; `kindLabel()` |
| `src/lib/data.ts` | modify | `TitleCard.universe`, `year`; universe in every card query; search ranks each universe on its own popularity scale |
| `db/schema.sql`, `scripts/seed-db.ts` | modify | `titles.year` (games: first release year) |
| `src/app/actions.ts` | modify | `search(query, universes)`, `clearTiers(kind, universe)`, revalidate both universes |
| `src/views/HomeView.tsx`, `RankingView.tsx`, `TitleView.tsx`, `TierListView.tsx`, `SharedTierListView.tsx`, `title-og.tsx` | create | Page bodies + metadata builders, moved out of the route files |
| `src/app/page.tsx`, `ranking/page.tsx`, `title/[slug]/*`, `tierlist/page.tsx`, `tierlist/[shareId]/*` | modify | Thin wrappers with `"reading"` |
| `src/app/games/layout.tsx`, `games/page.tsx`, `games/ranking/page.tsx`, `games/tierlist/page.tsx`, `games/tierlist/[shareId]/{page,opengraph-image}.tsx`, `games/tierlist/[shareId]/image/route.tsx`, `game/[slug]/{page,opengraph-image}.tsx` | create | Thin wrappers with `"games"` |
| `src/components/SiteNav.tsx` | create | Client nav: universe switch, Ranking and My tier list for the current universe |
| `src/components/HeaderSearch.tsx`, `RateButtons.tsx`, `TierBoard.tsx`, `FavoritesPicker.tsx`, `TierListNudge.tsx` | modify | Take a universe; wording and links from the config |
| `src/lib/tier-image.tsx` | modify | Caller passes the list name |
| `src/app/layout.tsx`, `sitemap.ts`, `robots.ts`, `legal/page.tsx`, `privacy/page.tsx` | modify | Nav, footer credits, games in sitemap and robots, IGDB credit |
| `src/app/globals.css` | modify | Universe switch, search badges |

---

### Task 1: Universe config, genres, kinds

- [ ] **Step 1: `src/lib/universes.ts`**

```ts
import type { Kind } from "@/lib/kinds";

export type Universe = "reading" | "games";
export const UNIVERSES: Universe[] = ["reading", "games"];

export function parseUniverse(value: string | null | undefined): Universe | null {
  return UNIVERSES.includes(value as Universe) ? (value as Universe) : null;
}

export interface UniverseConfig {
  id: Universe;
  label: string;
  emoji: string;
  // "" for reading: its pages kept their original URLs
  basePath: string;
  titlePath: string;
  // "read" / "play" and friends, for sentences
  verb: string;
  past: string;
  people: string;
  person: string;
  // "reads" in "Your next reads" / "Find your next read"
  next: string;
  nextPlural: string;
  want: string;
  catalog: string;
  searchPlaceholder: string;
  source: { name: string; url: string };
}

export const UNIVERSE_CONFIG: Record<Universe, UniverseConfig> = {
  reading: {
    id: "reading",
    label: "Reading",
    emoji: "📖",
    basePath: "",
    titlePath: "/title",
    verb: "read",
    past: "read",
    people: "readers",
    person: "reader",
    next: "read",
    nextPlural: "reads",
    want: "Want to read",
    catalog: "manga, manhwa or manhua",
    searchPlaceholder: "Search any manga, manhwa or manhua…",
    source: { name: "AniList", url: "https://anilist.co" },
  },
  games: {
    id: "games",
    label: "Games",
    emoji: "🎮",
    basePath: "/games",
    titlePath: "/game",
    verb: "play",
    past: "played",
    people: "players",
    person: "player",
    next: "game",
    nextPlural: "games",
    want: "Want to play",
    catalog: "games",
    searchPlaceholder: "Search any game…",
    source: { name: "IGDB", url: "https://www.igdb.com" },
  },
};

// /games/… and /game/… belong to Games, everything else to Reading
export function universeOfPath(pathname: string): Universe {
  return pathname === "/games" || pathname.startsWith("/games/") || pathname.startsWith("/game/") ? "games" : "reading";
}

export function titleHref(title: { slug: string; universe: Universe }): string {
  return `${UNIVERSE_CONFIG[title.universe].titlePath}/${title.slug}`;
}

export function universePath(universe: Universe, path: "" | "/ranking" | "/tierlist"): string {
  return UNIVERSE_CONFIG[universe].basePath + path || "/";
}

// Kept here so client components don't import the server-only data module
export type { Kind };
```

- [ ] **Step 2: `src/lib/game-genres.ts`** — names must match `GAME_GENRE_RULES` in `scripts/lib/game-genres.ts` (the worker image can't import `src/`, hence the copy; add a comment in both files pointing to the other).

```ts
export interface GameGenre {
  name: string;
  slug: string;
  // "Best roguelites"
  plural: string;
}

const genre = (name: string, plural: string): GameGenre => ({
  name,
  slug: name.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
  plural,
});

// Same names and order as scripts/lib/game-genres.ts
export const GAME_GENRES: GameGenre[] = [
  genre("Roguelite", "roguelites"),
  genre("Deckbuilder", "deckbuilders"),
  genre("Metroidvania", "metroidvanias"),
  genre("Soulslike", "soulslikes"),
  genre("RPG", "RPGs"),
  genre("JRPG", "JRPGs"),
  genre("Strategy", "strategy games"),
  genre("Shooter", "shooters"),
  genre("Platformer", "platformers"),
  genre("Puzzle", "puzzle games"),
  genre("Adventure", "adventure games"),
  genre("Fighting", "fighting games"),
  genre("Racing", "racing games"),
  genre("Sports", "sports games"),
  genre("Simulation", "simulation games"),
  genre("Visual novel", "visual novels"),
  genre("Survival", "survival games"),
  genre("Horror", "horror games"),
  genre("Open world", "open world games"),
  genre("Cozy", "cozy games"),
  genre("Indie", "indie games"),
];

export function parseGenre(slug: string | null | undefined): GameGenre | null {
  return GAME_GENRES.find((g) => g.slug === slug) ?? null;
}
```

- [ ] **Step 3: `src/lib/kinds.ts`** — `export type Kind = "manhwa" | "manga" | "manhua" | "game";` `KINDS` stays the three reading kinds (they are the Reading filters). Add:

```ts
const GAME_LABEL = "Game 🎮";
export function kindLabel(kind: Kind): string {
  return kind === "game" ? GAME_LABEL : (KINDS.find((k) => k.value === kind)?.label ?? kind);
}
```

`parseKind` keeps accepting only the reading kinds.

- [ ] **Step 4:** `npm run lint` → OK. Commit (after asking): "Add per-universe UI config and game genres".

---

### Task 2: Data layer

- [ ] **Step 1: Year** — `db/schema.sql`: `ALTER TABLE titles ADD COLUMN IF NOT EXISTS year INTEGER;` In `scripts/seed-db.ts`: `CatalogEntry.released?: number | null`; row `year: t.released ?? null`; `ON CONFLICT` sets `year = excluded.year`. Run `npm run db:seed`. Commit this step on its own (it is deployed first, see Task 6).

- [ ] **Step 2: `src/lib/data.ts`**
  - `TitleCard` gains `universe: Universe` and `year: number | null`; `toCard` reads `row.universe` and `row.year`.
  - Every query feeding `toCard` selects `t.universe, t.year` too: `getRanking`, `searchTitles`, `getCards`, `getLibrary` (and `getTitle` already selects `t.*`).
  - Re-export `type Universe` stays.
  - `searchTitles(query, limit = 24, universes = ["reading"])` ranks each universe on its own scale (IGDB rating counts are ~100× smaller than AniList popularity):

```ts
  const rows = await sql`
    WITH top AS (SELECT universe, GREATEST(MAX(popularity), 1) AS m FROM titles GROUP BY universe)
    SELECT t.id, t.slug, t.name, t.kind, t.cover, t.universe, t.year FROM titles t JOIN top USING (universe)
    WHERE t.search ILIKE ${"%" + normalized + "%"} AND t.universe IN ${sql(universes)}
    ORDER BY t.popularity::float / top.m DESC LIMIT ${limit}
  `;
```

- [ ] **Step 3: `src/app/actions.ts`**
  - `search(query: string, universes: Universe[] = ["reading"])`: keep only valid universes (`UNIVERSES.includes`), fall back to `["reading"]`.
  - `clearTiers(kind: Kind | null, universe: Universe = "reading")`: validate `universe`; `AND t.universe = ${universe}`.
  - A `revalidateLists()` helper replaces the repeated `revalidatePath` pairs: `"/"`, `"/tierlist"`, `"/games"`, `"/games/tierlist"`.

- [ ] **Step 4:** `npm run lint && npm run build` → OK (callers still pass nothing → Reading). Commit: "Carry the universe on title cards".

---

### Task 3: Shared views (Reading only, no visible change)

Move each page body into `src/views/`, parameterised by `universe`, and turn the Reading route files into wrappers. Do one view at a time and check the page in the browser after each.

- [ ] **Step 1: `src/views/RankingView.tsx`** — `export async function rankingMetadata(universe, searchParams)` and `export default function RankingView({ universe, searchParams })`.
  - Reading: unchanged (kind chips, "Best manhwa, manga & manhua", canonical `/ranking?kind=…`).
  - Games: filter chips are `GAME_GENRES` (`?genre=slug`), heading `Best ${genre.plural}` or "Best games", description `The ${genre?.plural ?? "games"} Reddit recommends most, refined by TierBase players' tier lists. Scores out of 100.`, canonical `/games/ranking?genre=…`. Show only genres that have at least one ranked game (compute from the unfiltered ranking + `getGenres`, or add `genres` to the ranking rows for games only — prefer a single `SELECT DISTINCT jsonb_array_elements_text(genres)` over ranked games, cached with the ranking tag).
  - Column header "Readers" → `capitalize(config.people)`; row links `titleHref(t)`; form `action={universePath(universe, "/ranking")}`.
  - Route: `src/app/ranking/page.tsx` → `export const generateMetadata = ({ searchParams }) => rankingMetadata("reading", searchParams); export default (props) => <RankingView universe="reading" searchParams={props.searchParams} />`.

- [ ] **Step 2: `src/views/TitleView.tsx`** — `titleMetadata(universe, slug)` + `TitleView({ universe, params })`, from `src/app/title/[slug]/page.tsx`:
  - `getTitle(slug, universe)`.
  - Kind name for headings: reading keeps `Manhwa like X`; games use `Games like X`.
  - JSON-LD `@type`: `"Book"` / `"VideoGame"`; `url` via `titleHref`.
  - "Have you read it?" → `Have you ${config.past === "read" ? "read" : "played"} it?` (write it as `Have you ${config.past} it?`).
  - "What readers who loved it also loved." / "Not enough readers yet" → `config.people`.
  - Games: show `year` next to the kind tag; no "Original title" line (null anyway).
  - Similar links: `titleHref(r.title)`.
  - `MyRating` passes `universe` to `RateButtons`.
- [ ] **Step 3: `src/views/title-og.tsx`** — the OG image body from `src/app/title/[slug]/opengraph-image.tsx`, taking `universe` ("Readers"/"Players who loved it also loved", kind label from `kindLabel`).
- [ ] **Step 4: `src/views/HomeView.tsx`** — from `src/app/page.tsx`: `Onboarding`, `Because`, `Dashboard`, `HomeContent`, all with `universe`:
  - `getLibrary(userId, universe)`, `getRanking({ universe })`, `personalRecommendations(userId, n, universe)`.
  - Texts: "Find your next {next}", "Pick a few {catalog} you loved…", "Rank what you've {past}", "Your next {nextPlural}", "liked by N {person|people}", "Have you {past} these?", "Popular {catalog === 'games' ? 'games' : 'titles'} not in your tier list yet".
  - Compact meta line: reading = kind · genres · score; games = genres · year · score.
  - Links via `titleHref` and `universePath`.
- [ ] **Step 5: `src/views/TierListView.tsx`** — from `src/app/tierlist/page.tsx`: `getLibrary(userId, universe)`, `getRanking({ universe })`, share URL `…/{basePath}/tierlist/{shareId}`, intro text with `config.past` and a link to `universePath(universe, "")`. Metadata title "My tier list" (reading) / "My games tier list".
- [ ] **Step 6: `src/views/SharedTierListView.tsx`** — from `src/app/tierlist/[shareId]/page.tsx`: name `A ${config.person}'s tier list`; description per universe; `getLibrary(owner.id, universe)` for both owner and viewer; `skipBasket: userBasket(owner.id, universe)`; kind chips only for reading; "read these next" → `${config.verb} these next`; links via `titleHref`/`universePath`. Also export `sharedTierListImage(universe, shareId, request)` used by both `image/route.tsx` files, and the OG image body (passes the name to `TierImage`).
- [ ] **Step 7: Components**
  - `RateButtons`: prop `universe`; the "want" choice label is `config.want`; the saved note links to `universePath(universe, "/tierlist")`.
  - `TierListNudge`: prop `universe` → link.
  - `FavoritesPicker`: prop `universe` → placeholder, button "Finding your next {nextPlural}…", `search(value, [universe])`, `track("Favorites picked", { count, universe })`.
  - `TierBoard`: prop `universe` → `search(value, [universe])`, "Want to read/play" section title and help text (`config.want`, `config.past`), `clearTiers(kind, universe)`, kind chips only when `universe === "reading"`, analytics events get `universe`.
- [ ] **Step 8: Check Reading is unchanged** — `npm run lint && npm run build`, then walk through `/`, `/ranking`, `/ranking?kind=manga`, a title page, `/tierlist`, a shared tier list, its image download, `/title/<slug>/opengraph-image`: same content as on production. Commit: "Move page bodies into universe-aware views".

---

### Task 4: Games routes

- [ ] **Step 1: `src/app/games/layout.tsx`** — `metadata: { title: { default: "TierBase — find your next game", template: "%s · TierBase" }, description: "Personal video game recommendations and tier lists built from what Reddit players actually recommend." }`, renders `children` (check the Next docs for nested layout metadata).
- [ ] **Step 2: Wrappers** — `games/page.tsx`, `games/ranking/page.tsx`, `games/tierlist/page.tsx`, `games/tierlist/[shareId]/page.tsx`, `games/tierlist/[shareId]/opengraph-image.tsx`, `games/tierlist/[shareId]/image/route.tsx`, `game/[slug]/page.tsx`, `game/[slug]/opengraph-image.tsx`: each renders the matching view or helper with `"games"` (same exports as the Reading files: `metadata`/`generateMetadata`, `alt`, `size`, `contentType`).
- [ ] **Step 3: Check** — `npm run build` lists the new routes. Browser: `/games` onboarding shows popular games; pick 3 (e.g. Hades, Hollow Knight, Slay the Spire) → recommendations appear with "% match" and "Because you liked…"; `/games/ranking` and `?genre=roguelite`; a game page (Hades: genres, year, similar games, Reddit quotes from r/roguelites); `/games/tierlist` drag-and-drop, "Want to play"; share link and image download; `/game/hades/opengraph-image`.
- [ ] **Step 4:** Commit: "Add the games pages".

---

### Task 5: Header, search, footer, SEO

- [ ] **Step 1: `src/components/SiteNav.tsx`** (client) — `usePathname()` → `universeOfPath`. Renders:
  - a segmented switch `📖 Reading | 🎮 Games` linking to `/` and `/games` (`aria-current` on the active one);
  - `HeaderSearch`, `Ranking` (`universePath(u, "/ranking")`), `My tier list` (`universePath(u, "/tierlist")`), the GitHub icon (passed as children from the server layout so the SVG and `REPO_URL` stay there).
  - `src/app/layout.tsx` uses it in place of the current `<nav>` content.
  - CSS: on ≤ 560px the switch moves to its own full-width row under the logo and links (`flex-wrap`, `order`), so nothing overflows at 375px.
- [ ] **Step 2: `HeaderSearch`** — `search(value, ["reading", "games"])`; each result shows `config.emoji` as a badge, `kindLabel(t.kind)` and the year for games; navigates to `titleHref(t)`. Placeholder "Search manga, manhwa, manhua or games…".
- [ ] **Step 3: Footer and legal** — footer credits "Data from AniList, IGDB and Reddit" (each linked); `legal/page.tsx` data sources mention IGDB (game titles, covers, genres; "not affiliated with … IGDB or Twitch"); `privacy/page.tsx` "want to read or skip" → "want to read, want to play or skip". Root `metadata` description mentions games.
- [ ] **Step 4: Sitemap and robots** — `sitemap.ts`: add `/games`, `/games/ranking`, `/games/ranking?genre=<slug>` for genres with ranked games, and `/game/<slug>` for games with mentions or votes (select `universe` and build URLs with `titleHref`). `robots.ts`: disallow `/games/tierlist$` too.
- [ ] **Step 5: Check** — header at 1200px and 375px on both universes; search `hades` → the game (🎮) and the manga (📖) if any, `resident evil 4` → entries with years; footer links; `/sitemap.xml` contains game URLs. `npm run lint && npm run build`. Commit: "Add the Reading/Games switch, mixed search and games SEO".

---

### Task 6: Final pass

- [ ] Lint, build, full walkthrough of both universes on desktop and phone width (Chrome window can't be resized here: use the device toolbar if available, otherwise ask the user to check on their phone).
- [ ] Update `README.md` intro if wording changed, and the spec's "Delivery steps" (step 4 folded into step 3).
- [ ] Ask the user, then deploy in two pushes. Vercel prerenders pages against the production database while building, so a site build that selects `titles.year` fails if it runs before the VM worker has applied the migration (this broke the step 2 deploy):
  1. Push the commit that only touches `db/schema.sql` and `scripts/seed-db.ts` (Task 2 Step 1); wait for the "Deploy VM" workflow to succeed and a few minutes for the worker's startup seed.
  2. Push the rest; check the Vercel deployment is Ready (`vercel ls`).
