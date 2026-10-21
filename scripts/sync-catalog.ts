import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fetchJson } from "./lib/http.ts";

const ROOT = join(import.meta.dirname, "..");
// AniList stops paginating after 5,000 results per query, so each country is queried separately.
// Its JP filter (and a null country) returns nothing, so the unfiltered top (mostly Japanese) stands in for it.
const MAX_PAGES = 100;
const COUNTRIES = [null, "KR", "CN", "TW"];

const query = (withCountry: boolean) => `query ($page: Int${withCountry ? ", $country: CountryCode" : ""}) {
  Page(page: $page, perPage: 50) {
    pageInfo { hasNextPage }
    media(type: MANGA, sort: POPULARITY_DESC${withCountry ? ", countryOfOrigin: $country" : ""}) {
      id
      isAdult
      title { romaji english native }
      description(asHtml: false)
      synonyms
      countryOfOrigin
      format
      status
      genres
      popularity
      siteUrl
      coverImage { large }
    }
  }
}`;

interface Media {
  id: number;
  isAdult: boolean;
  title: { romaji: string | null; english: string | null; native: string | null };
  description: string | null;
  synonyms: string[];
  countryOfOrigin: string;
  format: string;
  status: string;
  genres: string[];
  popularity: number;
  siteUrl: string;
  coverImage: { large: string };
}

const catalog = [];
const seen = new Set<number>();
for (const country of COUNTRIES) {
  for (let page = 1; page <= MAX_PAGES; page++) {
    const res = await fetchJson<{ data: { Page: { pageInfo: { hasNextPage: boolean }; media: Media[] } } }>(
      "https://graphql.anilist.co",
      {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ query: query(country !== null), variables: country ? { page, country } : { page } }),
      },
      { spacingMs: 2200 },
    );
    for (const m of res.data.Page.media.filter((m) => !m.isAdult && !seen.has(m.id))) {
      seen.add(m.id);
      catalog.push({
        id: m.id,
        name: m.title.english ?? m.title.romaji,
        romaji: m.title.romaji,
        native: m.title.native,
        description: m.description,
        synonyms: m.synonyms,
        origin: m.countryOfOrigin,
        format: m.format,
        status: m.status,
        genres: m.genres,
        popularity: m.popularity,
        url: m.siteUrl,
        cover: m.coverImage.large,
      });
    }
    if (page % 20 === 0) console.log(`${country ?? "ALL"} page ${page}: ${catalog.length} titles`);
    if (!res.data.Page.pageInfo.hasNextPage) break;
  }
}

mkdirSync(join(ROOT, "data/cache"), { recursive: true });
writeFileSync(join(ROOT, "data/cache/anilist.json"), JSON.stringify(catalog));
console.log(`Saved ${catalog.length} titles`);
