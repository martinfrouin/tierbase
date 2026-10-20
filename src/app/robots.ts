import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";

export default function robots(): MetadataRoute.Robots {
  return {
    // Personal pages: recommendations and tier lists depend on the visitor's cookie or belong to someone
    rules: { userAgent: "*", allow: "/", disallow: ["/for-you", "/tierlist"] },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
