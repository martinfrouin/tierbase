import type { MetadataRoute } from "next";
import { cacheLife } from "next/cache";
import { sql } from "@/lib/db";
import { SITE_URL } from "@/lib/site";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  "use cache";
  cacheLife("days");

  const titles = await sql`
    SELECT slug FROM titles
    WHERE id IN (SELECT title_id FROM mentions UNION SELECT title_id FROM ratings WHERE tier IS NOT NULL)
    ORDER BY popularity DESC
  `;
  return [
    { url: SITE_URL, changeFrequency: "daily", priority: 1 },
    { url: `${SITE_URL}/ranking`, changeFrequency: "daily", priority: 0.9 },
    ...titles.map((t) => ({ url: `${SITE_URL}/title/${t.slug}`, changeFrequency: "weekly" as const, priority: 0.7 })),
  ];
}
