import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { sql } from "@/lib/db";
import { KINDS, type Kind } from "@/lib/kinds";

export { KINDS, type Kind };

export type Tier = "S" | "A" | "B" | "C" | "D";
export type LibraryState = "rated" | "want" | "skip";

export const TIERS: Tier[] = ["S", "A", "B", "C", "D"];
// Cache tag for everything derived from votes; Server Actions expire it after each vote
export const RATINGS_TAG = "ratings";
export const TIER_VALUE: Record<Tier, number> = { S: 5, A: 4, B: 3, C: 2, D: 1 };

// Scores are computed on the S..D scale (1-5) and shown out of 100
export function scoreOutOf100(score: number): number {
  return Math.round(((score - 1) / 4) * 100);
}

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
  // Site visitors' average vote, rounded to a tier
  avgTier: Tier | null;
  score: number;
}

export interface TitleDetail extends RankedTitle {
  romaji: string | null;
  native: string | null;
  tierCounts: Record<Tier, number>;
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

// Loved (S) titles steer recommendations far more than liked (A) ones
export const TIER_WEIGHT: Partial<Record<Tier, number>> = { S: 1, A: 0.35 };

export interface Recommendation {
  title: TitleCard;
  score: number;
  // 0-100, relative to the best recommendation of the same list
  match: number;
  // Reddit readers and site users who like one of the seed titles and this one
  readers: number;
  because: TitleCard[];
}

// Bayesian average: each title starts with virtual votes at a Reddit-based prior. The more Reddit readers cited it,
// the more virtual votes (half a vote per mention, clamped), so a lone tier list vote can't outweigh 40 recommendations.
const MIN_PRIOR_WEIGHT = 3;
const MAX_PRIOR_WEIGHT = 25;
const MIN_REFERENCE_MENTIONS = 20;
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

// The overall ranking compares every title to the most cited one; a kind filter compares titles to the top of their kind,
// so the best manga still leads the manga ranking even though manhwa threads are far more numerous
export async function getRanking(kind?: Kind): Promise<RankedTitle[]> {
  "use cache";
  cacheLife("minutes");
  cacheTag(RATINGS_TAG);

  const rows = await sql`
    WITH m AS (SELECT title_id, COUNT(*)::int AS n FROM mentions GROUP BY title_id),
         r AS (SELECT title_id, COUNT(*)::int AS votes,
                      SUM(CASE tier WHEN 'S' THEN 5 WHEN 'A' THEN 4 WHEN 'B' THEN 3 WHEN 'C' THEN 2 ELSE 1 END)::int AS total
               FROM ratings WHERE tier IS NOT NULL GROUP BY title_id)
    SELECT t.id, t.slug, t.name, t.kind, t.cover,
           COALESCE(m.n, 0) AS mentions, COALESCE(r.votes, 0) AS votes, COALESCE(r.total, 0) AS total
    FROM titles t LEFT JOIN m ON m.title_id = t.id LEFT JOIN r ON r.title_id = t.id
    WHERE (m.n > 0 OR r.votes > 0) AND (${kind ?? null}::text IS NULL OR t.kind = ${kind ?? null})
  `;

  // Floored, so a kind with a handful of mentions can't hand out 5/5 priors
  const reference = Math.max(MIN_REFERENCE_MENTIONS, ...rows.map((r) => Number(r.mentions)));
  const scored = rows.map((row) => {
    const mentions = Number(row.mentions);
    const votes = Number(row.votes);
    // The most cited title starts at 5/5, a single mention at ~3/5
    const prior = 3 + (2 * Math.log1p(mentions)) / Math.log1p(reference);
    const weight = Math.min(MAX_PRIOR_WEIGHT, Math.max(MIN_PRIOR_WEIGHT, mentions / 2));
    const score = (weight * prior + Number(row.total)) / (weight + votes);
    const avgTier = votes ? TIERS[5 - Math.round(Number(row.total) / votes)] : null;
    return { ...toCard(row), mentions, votes, avgTier, score, rank: 0 };
  });

  scored.sort((a, b) => b.score - a.score || b.mentions - a.mentions);
  scored.forEach((t, i) => (t.rank = i > 0 && t.score === scored[i - 1].score ? scored[i - 1].rank : i + 1));
  return scored;
}

export async function getTitle(slug: string): Promise<TitleDetail | null> {
  "use cache";
  cacheLife("minutes");
  cacheTag(RATINGS_TAG);

  const [row] = await sql`
    SELECT t.*, (SELECT COUNT(*)::int FROM mentions WHERE title_id = t.id) AS mentions FROM titles t WHERE slug = ${slug}
  `;
  if (!row) return null;
  const [ranking, tierRows] = await Promise.all([
    getRanking(),
    sql`SELECT tier, COUNT(*)::int AS n FROM ratings WHERE title_id = ${row.id} AND tier IS NOT NULL GROUP BY tier`,
  ]);
  const ranked = ranking.find((t) => t.id === Number(row.id));
  const tierCounts = Object.fromEntries(TIERS.map((t) => [t, 0])) as Record<Tier, number>;
  for (const r of tierRows) tierCounts[String(r.tier).trim() as Tier] = Number(r.n);
  return {
    ...toCard(row),
    rank: ranked?.rank ?? 0,
    mentions: Number(row.mentions),
    votes: ranked?.votes ?? 0,
    avgTier: ranked?.avgTier ?? null,
    score: ranked?.score ?? 0,
    tierCounts,
    romaji: row.romaji as string | null,
    native: row.native as string | null,
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
  cacheTag(RATINGS_TAG);

  const rows = await sql`SELECT title_id, COUNT(*)::int AS n FROM baskets GROUP BY title_id`;
  return new Map(rows.map((r) => [Number(r.title_id), Number(r.n)]));
}

// Item-to-item collaborative filtering over "baskets" (a Reddit user's citations or a site user's S/A titles):
// titles liked by the same readers are similar, normalized so blockbusters don't dominate.
export async function recommend(
  liked: { titleId: number; weight: number }[],
  exclude: Set<number>,
  { limit = 20, skipBasket }: { limit?: number; skipBasket?: string } = {},
): Promise<Recommendation[]> {
  if (liked.length === 0) return [];
  const weights = new Map(liked.map((l) => [l.titleId, l.weight]));

  // A pair from a 3-title comment says more than a pair from a 70-title list, so big baskets weigh less
  const rows = await sql`
    WITH weighted AS (SELECT basket, title_id, 1 / sqrt(COUNT(*) OVER (PARTITION BY basket)) AS w FROM baskets)
    SELECT b1.title_id AS source, b2.title_id AS candidate, SUM(b1.w)::float AS together
    FROM weighted b1 JOIN weighted b2 ON b1.basket = b2.basket AND b2.title_id <> b1.title_id
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
  if (top.length === 0) return [];
  const ids = [...new Set(top.flatMap(([id, e]) => [id, ...e.sources.keys()]))];
  const [cards, readerRows] = await Promise.all([
    getCards(ids),
    sql`
      SELECT b2.title_id, COUNT(DISTINCT b2.basket)::int AS n
      FROM baskets b1 JOIN baskets b2 ON b1.basket = b2.basket
      WHERE b1.title_id IN ${sql([...weights.keys()])} AND b2.title_id IN ${sql(top.map(([id]) => id))}
        AND b1.basket <> ${skipBasket ?? ""}
      GROUP BY b2.title_id
    `,
  ]);
  const readers = new Map(readerRows.map((r) => [Number(r.title_id), Number(r.n)]));
  const best = top[0][1].score;

  return top.map(([id, entry]) => ({
    title: cards.get(id)!,
    score: entry.score,
    match: Math.round((100 * entry.score) / best),
    readers: readers.get(id) ?? 0,
    because: [...entry.sources].sort((a, b) => b[1] - a[1]).map(([sourceId]) => cards.get(sourceId)!),
  }));
}

export async function similarTitles(titleId: number, limit = 12): Promise<Recommendation[]> {
  "use cache";
  cacheLife("minutes");
  cacheTag(RATINGS_TAG);
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

export async function getUserByShareId(shareId: string): Promise<{ id: string; listName: string | null } | null> {
  const [row] = await sql`SELECT id, list_name FROM users WHERE share_id = ${shareId}`;
  return row ? { id: String(row.id), listName: (row.list_name as string | null) ?? null } : null;
}

export async function getShareInfo(userId: string): Promise<{ shareId: string; listName: string | null } | null> {
  const [row] = await sql`SELECT share_id, list_name FROM users WHERE id = ${userId}`;
  return row ? { shareId: String(row.share_id), listName: (row.list_name as string | null) ?? null } : null;
}

// Share of common titles both readers rated, weighted by how close their tiers are (same tier = 100%)
export function tasteMatch(a: LibraryEntry[], b: LibraryEntry[]): { common: number; match: number } | null {
  const tiersOf = new Map(b.filter((e) => e.tier).map((e) => [e.title.id, TIER_VALUE[e.tier!]]));
  const gaps = a
    .filter((e) => e.tier && tiersOf.has(e.title.id))
    .map((e) => Math.abs(TIER_VALUE[e.tier!] - tiersOf.get(e.title.id)!));
  if (gaps.length === 0) return null;
  return { common: gaps.length, match: Math.round(100 * (1 - gaps.reduce((x, y) => x + y, 0) / (4 * gaps.length))) };
}

export async function getEntry(
  userId: string,
  titleId: number,
): Promise<{ tier: Tier | null; state: LibraryState } | null> {
  const [row] = await sql`SELECT tier, state FROM ratings WHERE user_id = ${userId} AND title_id = ${titleId}`;
  return row ? { tier: (row.tier as Tier | null) ?? null, state: row.state as LibraryState } : null;
}

export async function personalRecommendations(userId: string, limit = 20): Promise<Recommendation[]> {
  const library = await getLibrary(userId);
  const liked = library
    .filter((e) => e.tier === "S" || e.tier === "A")
    .map((e) => ({ titleId: e.title.id, weight: TIER_WEIGHT[e.tier!] ?? 0 }));
  const exclude = new Set(library.map((e) => e.title.id));
  return recommend(liked, exclude, { limit, skipBasket: `u:${userId}` });
}
