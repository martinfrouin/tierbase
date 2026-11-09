import type { Universe } from "./subreddits.ts";

const MEDIUM: Record<Universe, string> = {
  reading: String.raw`(manhwas?|mangas?|manhuas?|webtoons?|comics?|series|reads?|titles?|stories|story|ones?)`,
  games: String.raw`(games?|rogue-?(lites?|likes?)|metroidvanias?|j?rpgs?|deck-?builders?|souls-?likes?|series|titles?|ones?)`,
};

const askingPatterns = (universe: Universe) => [
  new RegExp(
    String.raw`\b(best|favou?rites?|goats?|top ?\d+|all[- ]?time|underrated|hidden gems?|must[- ]?(reads?|plays?)|peak)\b.{0,50}\b${MEDIUM[universe]}\b`,
    "i",
  ),
  /\b(recommend\w*|recs?|suggest\w*|looking for|similar to|what (should|to) i (read|play)|need (something|a new|more))\b/i,
];
const ASKING_PATTERNS: Record<Universe, RegExp[]> = { reading: askingPatterns("reading"), games: askingPatterns("games") };

const OFF_TOPIC =
  /\b(guess|describe|badly|hair|beauty|husbands?|wives|waifus?|characters?|protagonists?|female leads?|male leads?|villains?|art ?style|cover|ships?|couples?|scene|panel|chapter|meme)\b/i;
// Gameplay help posts: "best build for…", "seed?", "controller settings"
const GAMES_OFF_TOPIC = /\b(builds?|seeds?|patch(es)?|achievements?|speedruns?|save ?files?|controllers?|settings|fps|crash(es|ing)?|mods?)\b/i;

const GENERIC_TAGS = new Set([
  "discussion", "recommendation", "recommendations", "rec", "recs", "request", "question", "title", "help", "other",
  "meta", "general", "none", "no title", "multiple", "any", "suggestion", "suggestions", "looking for", "rant",
]);

const SKIPPED_FLAIRS = /chapter discussion|meme|picture|art|help find|sauce|news|announcement/i;
// Flairs that already say "this post asks for recommendations"
const ASKING_FLAIRS = /recommendations? needed|recommendations?|request/i;

export function isRecommendationThread(
  post: { title: string; link_flair_text?: string | null },
  universe: Universe = "reading",
): boolean {
  if (post.link_flair_text && SKIPPED_FLAIRS.test(post.link_flair_text)) return false;
  const tag = post.title.match(/^\s*\[([^\]]*)\]/)?.[1].trim().toLowerCase();
  // "[Some Title] ..." posts are about one series and would skew its count
  if (tag !== undefined && !GENERIC_TAGS.has(tag) && !/recommend|request|suggest/.test(tag)) return false;
  if (OFF_TOPIC.test(post.title) || (universe === "games" && GAMES_OFF_TOPIC.test(post.title))) return false;
  return (
    (!!post.link_flair_text && ASKING_FLAIRS.test(post.link_flair_text)) ||
    ASKING_PATTERNS[universe].some((p) => p.test(post.title))
  );
}
