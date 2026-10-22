import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";

export default function robots(): MetadataRoute.Robots {
  return {
    // Personal pages depend on the visitor's cookie. Shared tier lists (/tierlist/<id>) stay crawlable so X and others
    // can fetch their preview card; they are noindex instead.
    rules: { userAgent: "*", allow: "/", disallow: ["/for-you", "/tierlist$", "/restore"] },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
