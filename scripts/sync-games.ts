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
