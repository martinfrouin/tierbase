import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { sql } from "@/lib/db";
import { KINDS, type Kind } from "@/lib/kinds";
import type { Universe } from "@/lib/universes";

export { KINDS, type Kind, type Universe };

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
  universe: Universe;
  year: number | null;
  genres: string[];
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
  description: string | null;
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

// Must match the baskets view in db/schema.sql
export function userBasket(userId: string, universe: Universe): string {
  return `u:${userId}:${universe}`;
}

export interface Recommendation {
  title: TitleCard;
  score: number;
  // 0-100, relative to the best recommendation of the same list
  match: number;
  // Reddit readers and site users who like one of the seed titles and this one
  readers: number;
  because: TitleCard[];
}

// Damps similarities built on very few shared readers
const SIMILARITY_SHRINK = 2;

function toCard(row: Record<string, unknown>): TitleCard {
  return {
    id: Number(row.id),
    slug: String(row.slug),
    name: String(row.name),
    kind: row.kind as Kind,
    cover: String(row.cover),
    universe: row.universe as Universe,
    year: row.year == null ? null : Number(row.year),
    genres: (row.genres as string[] | null) ?? [],
  };
}

// Scores are kept in titles.score (db/schema.sql): Bayesian average of a Reddit prior and tier list votes
function toRanked(row: Record<string, unknown>): RankedTitle {
  const votes = Number(row.votes);
  return {
    ...toCard(row),
    rank: Number(row.rank ?? 0),
    mentions: Number(row.mention_count),
    votes,
    avgTier: votes ? TIERS[5 - Math.round(Number(row.vote_total) / votes)] : null,
    score: Number(row.score),
  };
}

const RANKED_COLUMNS = sql`t.id, t.slug, t.name, t.kind, t.cover, t.universe, t.year, t.genres,
  t.mention_count, t.votes, t.vote_total, t.score`;
// Cited on Reddit or voted on (matches the titles_ranked_score index)
const RANKED = sql`(t.mention_count > 0 OR t.votes > 0)`;

// A kind (manhwa…) or a genre (Roguelite…), the same narrowing as the ranking chips
export interface TitleFilter {
  kind?: Kind;
  genre?: string;
}

// SQL condition on a titles row, aliased t unless told otherwise
function matches({ kind, genre }: TitleFilter, alias = sql`t`) {
  return sql`(${kind ?? null}::text IS NULL OR ${alias}.kind = ${kind ?? null})
    AND (${genre ?? null}::text IS NULL OR ${alias}.genres @> jsonb_build_array(${genre ?? null}::text))`;
}

export interface RankingFilter {
  universe?: Universe;
  kind?: Kind;
  genre?: string;
}

export interface RankingPage {
  titles: RankedTitle[];
  total: number;
}

// One page of a ranking. Ranks are positions within the kind or genre filter; the name search keeps those ranks.
export async function getRankingPage({
  universe = "reading",
  kind,
  genre,
  query,
  page = 1,
  pageSize = 50,
}: RankingFilter & { query?: string; page?: number; pageSize?: number }): Promise<RankingPage> {
  const pattern = query ? `%${query.replace(/[\\%_]/g, (c) => `\\${c}`)}%` : null;
  const rows = await sql`
    SELECT *, COUNT(*) OVER ()::int AS total FROM (
      SELECT ${RANKED_COLUMNS}, rank() OVER (ORDER BY t.score DESC)::int AS rank
      FROM titles t
      WHERE ${RANKED} AND t.universe = ${universe} AND ${matches({ kind, genre })}
    ) ranked
    WHERE ${pattern}::text IS NULL OR name ILIKE ${pattern}
    ORDER BY score DESC, mention_count DESC, id
    LIMIT ${pageSize} OFFSET ${(page - 1) * pageSize}
  `;
  return { titles: rows.map(toRanked), total: rows.length ? Number(rows[0].total) : 0 };
}

// Best ranked titles of a universe, minus the ones a visitor already has
export async function getTopTitles(
  universe: Universe,
  limit: number,
  exclude: number[] = [],
  only: TitleFilter = {},
): Promise<RankedTitle[]> {
  const rows = await sql`
    SELECT ${RANKED_COLUMNS} FROM titles t
    WHERE ${RANKED} AND t.universe = ${universe} AND t.id <> ALL(${exclude}::int[]) AND ${matches(only)}
    ORDER BY t.score DESC, t.mention_count DESC, t.id
    LIMIT ${limit}
  `;
  return rows.map(toRanked);
}

// Shared by every visitor (the landing page covers), so cached across instances
export async function getTopCovers(universe: Universe, limit: number): Promise<TitleCard[]> {
  "use cache: remote";
  cacheLife("hours");
  cacheTag(RATINGS_TAG);
  return getTopTitles(universe, limit);
}

export async function getTitle(slug: string, universe: Universe = "reading"): Promise<TitleDetail | null> {
  "use cache: remote";
  cacheLife("minutes");
  cacheTag(RATINGS_TAG);

  // Rank: how many titles of the universe score higher, plus one (titles with no mention and no vote are unranked)
  const [row] = await sql`
    SELECT t.*, CASE WHEN ${RANKED} THEN 1 + (
      SELECT COUNT(*) FROM titles o
      WHERE (o.mention_count > 0 OR o.votes > 0) AND o.universe = t.universe AND o.score > t.score
    ) ELSE 0 END::int AS rank
    FROM titles t WHERE t.slug = ${slug} AND t.universe = ${universe}
  `;
  if (!row) return null;
  const tierRows = await sql`
    SELECT tier, COUNT(*)::int AS n FROM ratings WHERE title_id = ${row.id} AND tier IS NOT NULL GROUP BY tier
  `;
  const tierCounts = Object.fromEntries(TIERS.map((t) => [t, 0])) as Record<Tier, number>;
  for (const r of tierRows) tierCounts[String(r.tier).trim() as Tier] = Number(r.n);
  return {
    ...toRanked(row),
    tierCounts,
    romaji: row.romaji as string | null,
    native: row.native as string | null,
    description: row.description as string | null,
    status: row.status as string | null,
    url: String(row.url),
  };
}

export async function getQuotes(titleId: number, limit = 6): Promise<Quote[]> {
  "use cache: remote";
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

export async function searchTitles(query: string, limit = 24, universes: Universe[] = ["reading"]): Promise<TitleCard[]> {
  const normalized = query
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/['’`]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
  if (normalized.length < 2) return [];
  const rows = await sql`
    WITH top AS (SELECT universe, GREATEST(MAX(popularity), 1) AS m FROM titles GROUP BY universe)
    SELECT t.id, t.slug, t.name, t.kind, t.cover, t.universe, t.year, t.genres FROM titles t JOIN top USING (universe)
    WHERE t.search ILIKE ${"%" + normalized + "%"} AND t.universe IN ${sql(universes)}
    -- IGDB rating counts are ~100x smaller than AniList popularity: rank each universe on its own scale
    ORDER BY t.popularity::float / top.m DESC LIMIT ${limit}
  `;
  return rows.map(toCard);
}

async function basketSizes(): Promise<Map<number, number>> {
  "use cache: remote";
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
  { limit = 20, skipBasket, only }: { limit?: number; skipBasket?: string; only?: TitleFilter } = {},
): Promise<Recommendation[]> {
  if (liked.length === 0) return [];
  const weights = new Map(liked.map((l) => [l.titleId, l.weight]));

  // A pair from a 3-title comment says more than a pair from a 70-title list, so big baskets weigh less (see db/schema.sql)
  const rows = await sql`
    SELECT b1.title_id AS source, b2.title_id AS candidate, SUM(b1.w)::float AS together
    FROM weighted_baskets b1 JOIN baskets b2 ON b1.basket = b2.basket AND b2.title_id <> b1.title_id
    ${only?.kind || only?.genre ? sql`JOIN titles c ON c.id = b2.title_id AND ${matches(only, sql`c`)}` : sql``}
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
  "use cache: remote";
  cacheLife("minutes");
  cacheTag(RATINGS_TAG);
  return recommend([{ titleId, weight: 1 }], new Set(), { limit });
}

export async function getCards(ids: number[]): Promise<Map<number, TitleCard>> {
  if (ids.length === 0) return new Map();
  const rows = await sql`SELECT id, slug, name, kind, cover, universe, year, genres FROM titles WHERE id IN ${sql(ids)}`;
  return new Map(rows.map((r) => [Number(r.id), toCard(r)]));
}

// How many ranked titles each genre has, to only offer filters that show something
export async function getRankedGenreCounts(universe: Universe): Promise<Map<string, number>> {
  "use cache: remote";
  cacheLife("hours");
  cacheTag(RATINGS_TAG);

  const rows = await sql`
    SELECT g, COUNT(*)::int AS n FROM titles t, jsonb_array_elements_text(t.genres) g
    WHERE ${RANKED} AND t.universe = ${universe}
    GROUP BY g
  `;
  return new Map(rows.map((r) => [String(r.g), Number(r.n)]));
}

export async function getGenres(ids: number[]): Promise<Map<number, string[]>> {
  if (ids.length === 0) return new Map();
  const rows = await sql`SELECT id, genres FROM titles WHERE id IN ${sql(ids)}`;
  return new Map(rows.map((r) => [Number(r.id), r.genres as string[]]));
}

export interface LibraryEntry {
  title: TitleCard;
  tier: Tier | null;
  state: LibraryState;
}

// universe null = the whole list, every universe
export async function getLibrary(userId: string, universe: Universe | null = "reading"): Promise<LibraryEntry[]> {
  const rows = await sql`
    SELECT t.id, t.slug, t.name, t.kind, t.cover, t.universe, t.year, t.genres, r.tier, r.state FROM ratings r JOIN titles t ON t.id = r.title_id
    WHERE r.user_id = ${userId} AND (${universe}::text IS NULL OR t.universe = ${universe}) ORDER BY r.updated_at
  `;
  return rows.map((r) => ({ title: toCard(r), tier: (r.tier as Tier | null) ?? null, state: r.state as LibraryState }));
}

export async function getUserByShareId(shareId: string): Promise<{ id: string } | null> {
  const [row] = await sql`SELECT id FROM users WHERE share_id = ${shareId}`;
  return row ? { id: String(row.id) } : null;
}

export async function getShareInfo(userId: string): Promise<{ shareId: string } | null> {
  const [row] = await sql`SELECT share_id FROM users WHERE id = ${userId}`;
  return row ? { shareId: String(row.share_id) } : null;
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

export async function personalRecommendations(
  userId: string,
  limit = 20,
  universe: Universe = "reading",
  only: TitleFilter = {},
): Promise<Recommendation[]> {
  const library = await getLibrary(userId, universe);
  const liked = library
    .filter((e) => e.tier === "S" || e.tier === "A")
    .map((e) => ({ titleId: e.title.id, weight: TIER_WEIGHT[e.tier!] ?? 0 }));
  const exclude = new Set(library.map((e) => e.title.id));
  return recommend(liked, exclude, { limit, skipBasket: userBasket(userId, universe), only });
}
