import "server-only";
import { cacheLife } from "next/cache";
import { sql } from "@/lib/db";

export type Kind = "manhwa" | "manga" | "manhua" | "comic" | "novel";
export type Tier = "S" | "A" | "B" | "C" | "D";
export type LibraryState = "rated" | "want" | "skip";

export const TIERS: Tier[] = ["S", "A", "B", "C", "D"];
export const TIER_VALUE: Record<Tier, number> = { S: 5, A: 4, B: 3, C: 2, D: 1 };

export const KINDS: { value: Kind; label: string }[] = [
  { value: "manhwa", label: "Manhwa 🇰🇷" },
  { value: "manga", label: "Manga 🇯🇵" },
  { value: "manhua", label: "Manhua 🇨🇳" },
  { value: "comic", label: "Comic" },
  { value: "novel", label: "Novel" },
];

export interface TitleCard {
  id: number;
  slug: string;
  name: string;
  kind: Kind;
  cover: string;
}

export interface RankedTitle extends TitleCard {
  rank: number;
  mentions: number;
  votes: number;
  score: number;
}

export interface TitleDetail extends RankedTitle {
  romaji: string | null;
  status: string | null;
  genres: string[];
  url: string;
}

export interface Quote {
  body: string;
  author: string;
  score: number;
  url: string;
  thread: { title: string; subreddit: string; url: string };
}

export interface Recommendation {
  title: TitleCard;
  score: number;
  because: TitleCard[];
}

// Bayesian average: each title starts with PRIOR_WEIGHT virtual votes at a Reddit-based prior
const PRIOR_WEIGHT = 5;
// Damps similarities built on very few shared readers
const SIMILARITY_SHRINK = 2;

function toCard(row: Record<string, unknown>): TitleCard {
  return {
    id: Number(row.id),
    slug: String(row.slug),
    name: String(row.name),
    kind: row.kind as Kind,
    cover: String(row.cover),
  };
}

export async function getRanking(): Promise<RankedTitle[]> {
  "use cache";
  cacheLife("minutes");

  const rows = await sql`
    WITH m AS (SELECT title_id, COUNT(*)::int AS n FROM mentions GROUP BY title_id),
         r AS (SELECT title_id, COUNT(*)::int AS votes,
                      SUM(CASE tier WHEN 'S' THEN 5 WHEN 'A' THEN 4 WHEN 'B' THEN 3 WHEN 'C' THEN 2 ELSE 1 END)::int AS total
               FROM ratings WHERE tier IS NOT NULL GROUP BY title_id)
    SELECT t.id, t.slug, t.name, t.kind, t.cover,
           COALESCE(m.n, 0) AS mentions, COALESCE(r.votes, 0) AS votes, COALESCE(r.total, 0) AS total
    FROM titles t LEFT JOIN m ON m.title_id = t.id LEFT JOIN r ON r.title_id = t.id
    WHERE m.n > 0 OR r.votes > 0
  `;

  const maxMentions = Math.max(1, ...rows.map((r) => Number(r.mentions)));
  const scored = rows.map((row) => {
    const mentions = Number(row.mentions);
    const votes = Number(row.votes);
    // Most-cited title on Reddit starts at 5/5, a single mention at ~3/5
    const prior = 3 + (2 * Math.log1p(mentions)) / Math.log1p(maxMentions);
    const score = (PRIOR_WEIGHT * prior + Number(row.total)) / (PRIOR_WEIGHT + votes);
    return { ...toCard(row), mentions, votes, score, rank: 0 };
  });

  scored.sort((a, b) => b.score - a.score || b.mentions - a.mentions);
  scored.forEach((t, i) => (t.rank = i > 0 && t.score === scored[i - 1].score ? scored[i - 1].rank : i + 1));
  return scored;
}

export async function getTitle(slug: string): Promise<TitleDetail | null> {
  "use cache";
  cacheLife("minutes");

  const [row] = await sql`
    SELECT t.*, (SELECT COUNT(*)::int FROM mentions WHERE title_id = t.id) AS mentions FROM titles t WHERE slug = ${slug}
  `;
  if (!row) return null;
  const ranked = (await getRanking()).find((t) => t.id === Number(row.id));
  return {
    ...toCard(row),
    rank: ranked?.rank ?? 0,
    mentions: Number(row.mentions),
    votes: ranked?.votes ?? 0,
    score: ranked?.score ?? 0,
    romaji: row.romaji as string | null,
    status: row.status as string | null,
    genres: row.genres as string[],
    url: String(row.url),
  };
}

export async function getQuotes(titleId: number, limit = 6): Promise<Quote[]> {
  "use cache";
  cacheLife("hours");

  const rows = await sql`
    SELECT m.comment_id, m.body, m.author, m.score, th.url, th.title, th.subreddit FROM mentions m
    JOIN threads th ON th.id = m.thread_id WHERE m.title_id = ${titleId} ORDER BY m.score DESC LIMIT ${limit}
  `;
  return rows.map((r) => ({
    body: String(r.body),
    author: String(r.author),
    score: Number(r.score),
    url: `${r.url}${r.comment_id}/`,
    thread: { title: String(r.title), subreddit: String(r.subreddit), url: String(r.url) },
  }));
}

export async function searchTitles(query: string, limit = 24): Promise<TitleCard[]> {
  const normalized = query
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/['’`]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
  if (normalized.length < 2) return [];
  const rows = await sql`
    SELECT id, slug, name, kind, cover FROM titles
    WHERE search ILIKE ${"%" + normalized + "%"} ORDER BY popularity DESC LIMIT ${limit}
  `;
  return rows.map(toCard);
}

async function basketSizes(): Promise<Map<number, number>> {
  "use cache";
  cacheLife("minutes");

  const rows = await sql`SELECT title_id, COUNT(*)::int AS n FROM baskets GROUP BY title_id`;
  return new Map(rows.map((r) => [Number(r.title_id), Number(r.n)]));
}

// Item-to-item collaborative filtering over "baskets" (a Reddit comment or a user's S/A titles):
// titles liked by the same readers are similar, normalized so blockbusters don't dominate.
export async function recommend(
  liked: { titleId: number; weight: number }[],
  exclude: Set<number>,
  { limit = 20, skipBasket }: { limit?: number; skipBasket?: string } = {},
): Promise<Recommendation[]> {
  if (liked.length === 0) return [];
  const weights = new Map(liked.map((l) => [l.titleId, l.weight]));

  const rows = await sql`
    SELECT b1.title_id AS source, b2.title_id AS candidate, COUNT(*)::int AS together
    FROM baskets b1 JOIN baskets b2 ON b1.basket = b2.basket AND b2.title_id <> b1.title_id
    WHERE b1.title_id IN ${sql([...weights.keys()])} AND b1.basket <> ${skipBasket ?? ""}
    GROUP BY b1.title_id, b2.title_id
  `;

  const sizes = await basketSizes();
  const candidates = new Map<number, { score: number; sources: Map<number, number> }>();
  for (const row of rows) {
    const source = Number(row.source);
    const candidate = Number(row.candidate);
    if (exclude.has(candidate) || weights.has(candidate)) continue;
    const similarity =
      Number(row.together) / (Math.sqrt((sizes.get(source) ?? 1) * (sizes.get(candidate) ?? 1)) + SIMILARITY_SHRINK);
    const contribution = similarity * (weights.get(source) ?? 1);
    const entry = candidates.get(candidate) ?? { score: 0, sources: new Map() };
    entry.score += contribution;
    entry.sources.set(source, (entry.sources.get(source) ?? 0) + contribution);
    candidates.set(candidate, entry);
  }

  const top = [...candidates].sort((a, b) => b[1].score - a[1].score).slice(0, limit);
  const ids = [...new Set(top.flatMap(([id, e]) => [id, ...e.sources.keys()]))];
  const cards = await getCards(ids);

  return top.map(([id, entry]) => ({
    title: cards.get(id)!,
    score: entry.score,
    because: [...entry.sources]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 2)
      .map(([sourceId]) => cards.get(sourceId)!),
  }));
}

export async function similarTitles(titleId: number, limit = 8): Promise<Recommendation[]> {
  "use cache";
  cacheLife("minutes");
  return recommend([{ titleId, weight: 1 }], new Set(), { limit });
}

export async function getCards(ids: number[]): Promise<Map<number, TitleCard>> {
  if (ids.length === 0) return new Map();
  const rows = await sql`SELECT id, slug, name, kind, cover FROM titles WHERE id IN ${sql(ids)}`;
  return new Map(rows.map((r) => [Number(r.id), toCard(r)]));
}

export interface LibraryEntry {
  title: TitleCard;
  tier: Tier | null;
  state: LibraryState;
}

export async function getLibrary(userId: string): Promise<LibraryEntry[]> {
  const rows = await sql`
    SELECT t.id, t.slug, t.name, t.kind, t.cover, r.tier, r.state FROM ratings r JOIN titles t ON t.id = r.title_id
    WHERE r.user_id = ${userId} ORDER BY r.updated_at
  `;
  return rows.map((r) => ({ title: toCard(r), tier: (r.tier as Tier | null) ?? null, state: r.state as LibraryState }));
}

export async function getUserByShareId(shareId: string): Promise<string | null> {
  const [row] = await sql`SELECT id FROM users WHERE share_id = ${shareId}`;
  return row ? String(row.id) : null;
}

export async function getShareId(userId: string): Promise<string | null> {
  const [row] = await sql`SELECT share_id FROM users WHERE id = ${userId}`;
  return row ? String(row.share_id) : null;
}

export async function getEntry(userId: string, titleId: number): Promise<{ tier: Tier | null; state: LibraryState } | null> {
  const [row] = await sql`SELECT tier, state FROM ratings WHERE user_id = ${userId} AND title_id = ${titleId}`;
  return row ? { tier: (row.tier as Tier | null) ?? null, state: row.state as LibraryState } : null;
}

export async function personalRecommendations(userId: string, limit = 20): Promise<Recommendation[]> {
  const library = await getLibrary(userId);
  const liked = library
    .filter((e) => e.tier === "S" || e.tier === "A")
    .map((e) => ({ titleId: e.title.id, weight: e.tier === "S" ? 1 : 0.7 }));
  const exclude = new Set(library.map((e) => e.title.id));
  return recommend(liked, exclude, { limit, skipBasket: `u:${userId}` });
}
