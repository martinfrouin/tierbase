import type { MetadataRoute } from "next";
import { cacheLife } from "next/cache";
import { getRankedGenreCounts } from "@/lib/data";
import { sql } from "@/lib/db";
import { KINDS } from "@/lib/kinds";
import { genresOf } from "@/lib/title-filters";
import { SITE_URL } from "@/lib/site";
import { titleHref, type Universe } from "@/lib/universes";

// Same threshold as the genre filters of the rankings
const MIN_GENRE_TITLES = 5;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  "use cache";
  cacheLife("days");

  const [titles, readingGenres, gameGenres] = await Promise.all([
    sql`
      SELECT slug, universe FROM titles
      WHERE mention_count > 0 OR votes > 0
      ORDER BY popularity DESC
    `,
    getRankedGenreCounts("reading"),
    getRankedGenreCounts("games"),
  ]);
  const genres = (universe: Universe, counts: Map<string, number>) =>
    genresOf(universe)
      .filter((g) => (counts.get(g.name) ?? 0) >= MIN_GENRE_TITLES)
      .map((g) => ranking(`/${universe}/ranking?genre=${g.slug}`));
  const ranking = (path: string) => ({ url: `${SITE_URL}${path}`, changeFrequency: "daily" as const, priority: 0.9 });
  return [
    { url: SITE_URL, changeFrequency: "daily", priority: 1 },
    { url: `${SITE_URL}/reading`, changeFrequency: "daily", priority: 1 },
    ranking("/reading/ranking"),
    ...KINDS.map((k) => ranking(`/reading/ranking?kind=${k.value}`)),
    ...genres("reading", readingGenres),
    { url: `${SITE_URL}/games`, changeFrequency: "daily", priority: 1 },
    ranking("/games/ranking"),
    ...genres("games", gameGenres),
    ...titles.map((t) => ({
      url: `${SITE_URL}${titleHref({ slug: String(t.slug), universe: t.universe as Universe })}`,
      changeFrequency: "weekly" as const,
      priority: 0.7,
    })),
  ];
}
