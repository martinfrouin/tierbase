import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { gzipSync } from "node:zlib";
import { fetchJson } from "./lib/http.ts";
import { isRecommendationThread } from "./lib/threads.ts";

const ROOT = join(import.meta.dirname, "..");
const API = "https://arctic-shift.photon-reddit.com/api";
const STATE_FILE = join(ROOT, "data/cache/state.json");

const SUBREDDITS = ["manhwa", "manhwarecommendations", "manga", "manhua", "webtoons"];
const BACKFILL_ARG = process.argv.find((a) => a.startsWith("--backfill-days="))?.split("=")[1];
const BACKFILL_DAYS = Number(BACKFILL_ARG ?? 30);
const REFRESH_DAYS = 4;
const MIN_COMMENTS = 10;

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
  lastSeen: Record<string, number>;
  pending: Record<string, Post>;
}

const state: State = existsSync(STATE_FILE)
  ? JSON.parse(readFileSync(STATE_FILE, "utf8"))
  : { lastSeen: {}, pending: {} };
const now = Math.floor(Date.now() / 1000);
mkdirSync(join(ROOT, "data/cache/threads"), { recursive: true });
const saveState = () => writeFileSync(STATE_FILE, JSON.stringify(state, null, 1));

async function discover(subreddit: string): Promise<Post[]> {
  // An explicit --backfill-days restarts the walk from that far back
  let after = (BACKFILL_ARG ? undefined : state.lastSeen[subreddit]) ?? now - BACKFILL_DAYS * 86400;
  const found: Post[] = [];
  // Unbounded searches time out on Arctic Shift, so walk one day at a time
  while (after < now) {
    const before = Math.min(after + 86400, now);
    const url =
      `${API}/posts/search?subreddit=${subreddit}&after=${after}&before=${before}&sort=asc&limit=100` +
      `&fields=id,title,author,subreddit,created_utc,link_flair_text`;
    const { data } = await fetchJson<{ data: Post[] }>(url);
    for (const post of data) post.permalink = `/r/${post.subreddit}/comments/${post.id}/`;
    found.push(...data.filter(isRecommendationThread));
    after = data.length === 100 ? data[data.length - 1].created_utc : before;
    if (before % (7 * 86400) < 86400) console.log(`r/${subreddit}: ${new Date(after * 1000).toISOString().slice(0, 10)}, ${found.length} candidate(s)`);
    state.lastSeen[subreddit] = after;
    if (found.length && found.length % 200 === 0) saveState();
  }
  return found;
}

function flatten(things: { kind: string; data: Comment }[], out: Omit<Comment, "replies">[] = []) {
  for (const { kind, data } of things) {
    if (kind !== "t1") continue;
    const { replies, ...comment } = data;
    out.push({ id: comment.id, parent_id: comment.parent_id, author: comment.author, body: comment.body, score: comment.score, created_utc: comment.created_utc });
    if (replies) flatten(replies.data.children, out);
  }
  return out;
}

async function fetchThread(post: Post) {
  const { data } = await fetchJson<{ data: { kind: string; data: Comment }[] }>(
    `${API}/comments/tree?link_id=${post.id}&limit=9999`,
  );
  const comments = flatten(data);
  if (comments.length < MIN_COMMENTS) return 0;
  writeFileSync(
    join(ROOT, "data/cache/threads", `${post.id}.json.gz`),
    gzipSync(JSON.stringify({ post, fetchedAt: now, comments })),
  );
  return comments.length;
}

let saved = 0;
let processed = 0;
const fetched = new Set<string>();

async function fetchPending(subreddit?: string) {
  for (const post of Object.values(state.pending)) {
    if (fetched.has(post.id) || (subreddit && post.subreddit.toLowerCase() !== subreddit)) continue;
    fetched.add(post.id);
    try {
      if ((await fetchThread(post)) > 0) saved++;
    } catch (error) {
      console.warn(`Skipping ${post.id}: ${(error as Error).message}`);
      continue;
    }
    if (now - post.created_utc > REFRESH_DAYS * 86400) delete state.pending[post.id];
    if (++processed % 50 === 0) {
      saveState();
      console.log(`${processed} thread(s) fetched`);
    }
  }
  saveState();
}

// Fetch each subreddit's threads right after discovering them, so a long backfill becomes usable progressively
for (const subreddit of SUBREDDITS) {
  const posts = await discover(subreddit);
  for (const post of posts) state.pending[post.id] = post;
  saveState();
  console.log(`r/${subreddit}: ${posts.length} new candidate thread(s)`);
  await fetchPending(subreddit);
}
await fetchPending();

console.log(`${saved} thread(s) saved, ${Object.keys(state.pending).length} still refreshing`);
