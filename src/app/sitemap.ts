import type { MetadataRoute } from "next";
import { cacheLife } from "next/cache";
import { getRankedGenreCounts } from "@/lib/data";
import { sql } from "@/lib/db";
import { GAME_GENRES } from "@/lib/game-genres";
import { KINDS } from "@/lib/kinds";
import { SITE_URL } from "@/lib/site";
import { titleHref, type Universe } from "@/lib/universes";

// Same threshold as the genre filters of the games ranking
const MIN_GENRE_TITLES = 5;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  "use cache";
  cacheLife("days");

  const [titles, genreCounts] = await Promise.all([
    sql`
      SELECT slug, universe FROM titles
      WHERE id IN (SELECT title_id FROM mentions UNION SELECT title_id FROM ratings WHERE tier IS NOT NULL)
      ORDER BY popularity DESC
    `,
    getRankedGenreCounts("games"),
  ]);
  const ranking = (path: string) => ({ url: `${SITE_URL}${path}`, changeFrequency: "daily" as const, priority: 0.9 });
  return [
    { url: SITE_URL, changeFrequency: "daily", priority: 1 },
    ranking("/ranking"),
    ...KINDS.map((k) => ranking(`/ranking?kind=${k.value}`)),
    { url: `${SITE_URL}/games`, changeFrequency: "daily", priority: 1 },
    ranking("/games/ranking"),
    ...GAME_GENRES.filter((g) => (genreCounts.get(g.name) ?? 0) >= MIN_GENRE_TITLES).map((g) =>
      ranking(`/games/ranking?genre=${g.slug}`),
    ),
    ...titles.map((t) => ({
      url: `${SITE_URL}${titleHref({ slug: String(t.slug), universe: t.universe as Universe })}`,
      changeFrequency: "weekly" as const,
      priority: 0.7,
    })),
  ];
}
