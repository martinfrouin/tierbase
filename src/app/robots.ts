import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";

// AI training crawlers fetch every page and send no visitors back. Assistant and AI search bots (ChatGPT-User,
// OAI-SearchBot, PerplexityBot, Claude-User…) stay allowed: they fetch a page when someone asks, and link to it.
const AI_BOTS = [
  "GPTBot",
  "ClaudeBot",
  "anthropic-ai",
  "CCBot",
  "Bytespider",
  "Google-Extended",
  "Applebot-Extended",
  "meta-externalagent",
  "Amazonbot",
  "cohere-ai",
  "Diffbot",
  "omgili",
  "Timpibot",
  "ImagesiftBot",
];

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        // Personal pages depend on the visitor's cookie. Shared tier lists (/tierlist/<id>) stay crawlable so X and
        // others can fetch their preview card; they are noindex instead. Ranking searches are endless variations of
        // pages crawlers already have.
        disallow: ["/reading/tierlist$", "/games/tierlist$", "/restore", "/*/ranking?*q="],
      },
      { userAgent: AI_BOTS, disallow: "/" },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
