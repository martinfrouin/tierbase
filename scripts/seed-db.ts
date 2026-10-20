import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { gunzipSync } from "node:zlib";
import postgres from "postgres";
import { TitleMatcher, normalize } from "./lib/matcher.ts";
import { isRecommendationThread } from "./lib/threads.ts";

interface CatalogEntry {
  id: number;
  name: string;
  romaji: string | null;
  synonyms: string[];
  origin: string;
  format: string;
  status: string;
  genres: string[];
  popularity: number;
  url: string;
  cover: string;
}

interface Thread {
  post: { id: string; title: string; author: string; subreddit: string; created_utc: number; permalink: string; link_flair_text: string | null };
  comments: { id: string; author: string; body: string; score: number }[];
}

const ROOT = join(import.meta.dirname, "..");
const IGNORED_AUTHORS = new Set(["AutoModerator", "[deleted]"]);
const PLOT_QUESTION =
  /what (the )?(hell |heck |tf )?happen|\bwth happen|spoil|why (does|did|is)|is it just me|still ongoing|is it (still|over|finished)|has it (started|ended)/i;
const LATIN = /^[\p{Script=Latin}\d\s\p{P}\p{S}]+$/u;

const sql = postgres(process.env.DATABASE_URL!, { onnotice: () => {} });
const CHUNK = 1000;

const readJson = <T>(path: string): T => JSON.parse(readFileSync(join(ROOT, path), "utf8"));

// AniList lists adaptations separately (manga vs light novel vs one-shot, ONE's webcomic vs Murata's One-Punch Man).
// Readers mean one series, so entries with the same name and origin collapse into the most popular one.
const mergedInto = new Map<number, number>();
const catalog = (() => {
  const raw = [...readJson<CatalogEntry[]>("data/cache/anilist.json"), ...readJson<CatalogEntry[]>("data/extra-titles.json")];
  const groups = new Map<string, CatalogEntry[]>();
  for (const t of raw) {
    const key = `${t.origin}:${normalize(t.name).replace(/ /g, "")}`;
    groups.set(key, [...(groups.get(key) ?? []), t]);
  }
  return [...groups.values()].map((group) => {
    const [main, ...others] = group.sort((a, b) => b.popularity - a.popularity);
    for (const o of others) mergedInto.set(o.id, main.id);
    const names = others.flatMap((o) => [o.name, o.romaji, ...o.synonyms]).filter((n): n is string => !!n);
    return { ...main, synonyms: [...new Set([...main.synonyms, ...names])] };
  });
})();
const exclusions = readJson<{ comments: Record<string, string> }>("data/exclusions.json");
const wordList = (path: string) => new Set(readFileSync(join(ROOT, path), "utf8").split("\n").filter(Boolean));
const matcher = new TitleMatcher(
  catalog,
  { common: wordList("data/common-words.txt"), dictionary: wordList("data/dictionary.txt") },
  readJson("data/aliases.json"),
);

function kind(t: CatalogEntry): string {
  if (t.format === "NOVEL") return "novel";
  return { KR: "manhwa", JP: "manga", CN: "manhua", TW: "manhua" }[t.origin] ?? "comic";
}

function slugify(name: string): string {
  return normalize(name).replace(/ /g, "-");
}

await sql.unsafe(readFileSync(join(ROOT, "db/schema.sql"), "utf8"));

// Slugs are public URLs: keep existing ones stable across catalog refreshes
const existingSlugs = new Map((await sql`SELECT id, slug FROM titles`).map((r) => [Number(r.id), String(r.slug)]));
const usedSlugs = new Set(existingSlugs.values());
const titleRows = [...catalog]
  .sort((a, b) => b.popularity - a.popularity)
  .map((t) => {
    let slug = existingSlugs.get(t.id);
    if (!slug) {
      slug = slugify(t.name) || String(t.id);
      if (usedSlugs.has(slug)) slug = `${slug}-${t.id}`;
      usedSlugs.add(slug);
    }
    return {
      id: t.id,
      slug,
      name: t.name,
      romaji: t.romaji,
      search: [t.name, t.romaji, ...t.synonyms].filter((n): n is string => !!n && LATIN.test(n)).map(normalize).join(" | "),
      kind: kind(t),
      origin: t.origin,
      status: t.status,
      genres: sql.json(t.genres),
      cover: t.cover,
      url: t.url,
      popularity: t.popularity,
    };
  });

for (let i = 0; i < titleRows.length; i += CHUNK) {
  await sql`
    INSERT INTO titles ${sql(titleRows.slice(i, i + CHUNK))}
    ON CONFLICT (id) DO UPDATE SET name = excluded.name, romaji = excluded.romaji,
      search = excluded.search, kind = excluded.kind, origin = excluded.origin, status = excluded.status,
      genres = excluded.genres, cover = excluded.cover, url = excluded.url, popularity = excluded.popularity
  `;
}

const threadRows: { id: string; subreddit: string; title: string; url: string; created_at: Date; analyzed_comments: number }[] = [];
const mentionRows: { comment_id: string; title_id: number; thread_id: string; author: string; score: number; body: string }[] = [];

for (const file of readdirSync(join(ROOT, "data/cache/threads")).filter((f) => f.endsWith(".json.gz"))) {
  const { post, comments }: Thread = JSON.parse(gunzipSync(readFileSync(join(ROOT, "data/cache/threads", file))).toString());
  if (!isRecommendationThread(post)) continue;

  let analyzed = 0;
  for (const c of comments) {
    if (c.author === post.author || IGNORED_AUTHORS.has(c.author) || exclusions.comments[c.id]) continue;
    if (c.body.includes("?") && PLOT_QUESTION.test(c.body)) continue;
    analyzed++;
    for (const titleId of matcher.match(c.body)) {
      mentionRows.push({ comment_id: c.id, title_id: titleId, thread_id: post.id, author: c.author, score: c.score, body: c.body.slice(0, 600) });
    }
  }
  threadRows.push({
    id: post.id,
    subreddit: post.subreddit,
    title: post.title,
    url: `https://www.reddit.com${post.permalink}`,
    created_at: new Date(post.created_utc * 1000),
    analyzed_comments: analyzed,
  });
}

// Single transaction so the site never sees a half-seeded Reddit dataset
await sql.begin(async (tx) => {
  await tx`TRUNCATE mentions, threads`;
  if (mergedInto.size) {
    const from = [...mergedInto.keys()];
    const to = [...mergedInto.values()];
    // Move votes on a merged-away entry to the kept one, unless the user already rated that one
    await tx`
      UPDATE ratings r SET title_id = m.to_id
      FROM unnest(${from}::int[], ${to}::int[]) AS m(from_id, to_id)
      WHERE r.title_id = m.from_id
        AND NOT EXISTS (SELECT 1 FROM ratings o WHERE o.user_id = r.user_id AND o.title_id = m.to_id)
    `;
    await tx`DELETE FROM ratings WHERE title_id IN ${tx(from)}`;
    await tx`DELETE FROM titles WHERE id IN ${tx(from)}`;
  }
  for (let i = 0; i < threadRows.length; i += CHUNK) await tx`INSERT INTO threads ${tx(threadRows.slice(i, i + CHUNK))}`;
  for (let i = 0; i < mentionRows.length; i += CHUNK) await tx`INSERT INTO mentions ${tx(mentionRows.slice(i, i + CHUNK))}`;
});

console.log(`${catalog.length} titles (${mergedInto.size} duplicates merged), ${threadRows.length} threads, ${mentionRows.length} mentions`);
await sql.end();
