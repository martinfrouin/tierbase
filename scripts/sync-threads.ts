import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { gzipSync } from "node:zlib";
import { fetchJson } from "./lib/http.ts";
import { isRecommendationThread } from "./lib/threads.ts";

const ROOT = join(import.meta.dirname, "..");
const API = "https://arctic-shift.photon-reddit.com/api";
const STATE_FILE = join(ROOT, "data/cache/state.json");
const THREADS_DIR = join(ROOT, "data/cache/threads");

// Sources per kind, so manga, manhwa and manhua each get comparable coverage
// Manhwa subreddits are far busier: the manga side gets the smaller demographic communities too
const SUBREDDITS = [
  "manhwa",
  "manhwarecommendations",
  "webtoons",
  "manga",
  "MangaRecommendations",
  "Seinen",
  "shoujo",
  "josei",
  "manhua",
];
const DAY = 86400;
// Each run extends the history further back by this much, until MAX_HISTORY_DAYS
const arg = (name: string) => process.argv.find((a) => a.startsWith(`--${name}=`))?.split("=")[1];
const HISTORY_DAYS = Number(arg("history-days") ?? 30);
// Fixed target instead ("cover the last N days"), safe to re-run after an interruption
const BACKFILL_TO_DAYS = arg("backfill-to-days");
const MAX_HISTORY_DAYS = 730;
const BLOCK_DAYS = 7;
const REFRESH_DAYS = 4;
const MIN_COMMENTS = 10;
const CONSENSUS = /\b(best|favou?rites?|goats?|top ?\d+|all[- ]?time|underrated|hidden gems?|must[- ]?reads?)\b/i;

interface Post {
  id: string;
  title: string;
  author: string;
  subreddit: string;
  created_utc: number;
  link_flair_text: string | null;
  permalink: string;
}

interface Comment {
  id: string;
  parent_id: string;
  author: string;
  body: string;
  score: number;
  created_utc: number;
  replies?: { data: { children: { kind: string; data: Comment }[] } } | "";
}

interface State {
  // Everything between oldest and newest has been scanned, per subreddit
  newest: Record<string, number>;
  oldest: Record<string, number>;
  // Recent threads re-fetched for a few days to catch new comments
  recent: Record<string, Post>;
}

const now = Math.floor(Date.now() / 1000);
mkdirSync(THREADS_DIR, { recursive: true });
const state: State = existsSync(STATE_FILE) ? JSON.parse(readFileSync(STATE_FILE, "utf8")) : {};
state.newest ??= {};
state.oldest ??= {};
state.recent ??= {};
const saveState = () => writeFileSync(STATE_FILE, JSON.stringify(state, null, 1));

async function scan(subreddit: string, after: number, before: number): Promise<Post[]> {
  const found: Post[] = [];
  // Wider windows time out on busy subreddits like r/manga, so walk one day at a time, newest first
  for (let dayEnd = before; dayEnd > after; dayEnd -= DAY) {
    const dayStart = Math.max(after, dayEnd - DAY);
    let cursor = dayEnd;
    for (;;) {
      const { data } = await fetchJson<{ data: Post[] }>(
        `${API}/posts/search?subreddit=${subreddit}&after=${dayStart}&before=${cursor}&sort=desc&limit=100` +
          `&fields=id,title,author,subreddit,created_utc,link_flair_text`,
      );
      for (const post of data) post.permalink = `/r/${post.subreddit}/comments/${post.id}/`;
      found.push(...data.filter(isRecommendationThread));
      if (data.length < 100) break;
      cursor = data[data.length - 1].created_utc;
    }
  }
  return found;
}

function flatten(things: { kind: string; data: Comment }[], out: Omit<Comment, "replies">[] = []) {
  for (const { kind, data } of things) {
    if (kind !== "t1") continue;
    out.push({ id: data.id, parent_id: data.parent_id, author: data.author, body: data.body, score: data.score, created_utc: data.created_utc });
    if (data.replies) flatten(data.replies.data.children, out);
  }
  return out;
}

let saved = 0;
async function fetchThreads(posts: Post[]) {
  // Consensus threads ("best manhwa ever?") first, they carry the most signal
  const ordered = [...posts].sort((a, b) => Number(CONSENSUS.test(b.title)) - Number(CONSENSUS.test(a.title)));
  for (const post of ordered) {
    const file = join(THREADS_DIR, `${post.id}.json.gz`);
    const isRecent = now - post.created_utc < REFRESH_DAYS * DAY;
    if (isRecent) state.recent[post.id] = post;
    if (existsSync(file) && !isRecent) continue;
    try {
      const { data } = await fetchJson<{ data: { kind: string; data: Comment }[] }>(
        `${API}/comments/tree?link_id=${post.id}&limit=9999`,
      );
      const comments = flatten(data);
      if (comments.length < MIN_COMMENTS) continue;
      writeFileSync(file, gzipSync(JSON.stringify({ post, fetchedAt: now, comments })));
      saved++;
    } catch (error) {
      console.warn(`Skipping ${post.id}: ${(error as Error).message}`);
    }
  }
  saveState();
}

// 1. Catch up on new posts, and keep refreshing recent threads
for (const subreddit of SUBREDDITS) {
  const from = state.newest[subreddit] ?? now - DAY;
  state.oldest[subreddit] ??= from;
  const posts = await scan(subreddit, from, now);
  state.newest[subreddit] = now;
  await fetchThreads(posts);
  console.log(`r/${subreddit}: ${posts.length} new candidate(s)`);
}
for (const [id, post] of Object.entries(state.recent)) {
  if (now - post.created_utc >= REFRESH_DAYS * DAY) delete state.recent[id];
}
await fetchThreads(Object.values(state.recent));

// 2. Extend history backwards one week at a time, all subreddits together, so data stays balanced if interrupted
const target = now - MAX_HISTORY_DAYS * DAY;
const stopAt = Math.max(
  target,
  BACKFILL_TO_DAYS ? now - Number(BACKFILL_TO_DAYS) * DAY : Math.min(...SUBREDDITS.map((s) => state.oldest[s])) - HISTORY_DAYS * DAY,
);
for (;;) {
  const pending = SUBREDDITS.filter((s) => state.oldest[s] > stopAt);
  if (pending.length === 0) break;
  for (const subreddit of pending) {
    const before = state.oldest[subreddit];
    const after = Math.max(stopAt, before - BLOCK_DAYS * DAY);
    const posts = await scan(subreddit, after, before);
    await fetchThreads(posts);
    state.oldest[subreddit] = after;
    saveState();
    console.log(`r/${subreddit}: back to ${new Date(after * 1000).toISOString().slice(0, 10)} (${posts.length} candidates, ${saved} threads saved so far)`);
  }
}

saveState();
console.log(`Done: ${saved} thread(s) saved`);
