import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  // Reading pages moved under /reading when games arrived: old links and search results keep working
  async redirects() {
    return [
      { source: "/for-you", destination: "/reading", permanent: true },
      { source: "/ranking", destination: "/reading/ranking", permanent: true },
      { source: "/tierlist/:path*", destination: "/reading/tierlist/:path*", permanent: true },
      // Title pages moved under their universe too
      { source: "/title/:path*", destination: "/reading/title/:path*", permanent: true },
      { source: "/game/:path*", destination: "/games/title/:path*", permanent: true },
      // autoconfig.tierbase.io only exists to serve mail client settings (src/lib/mail-autoconfig.ts)
      {
        source: "/:path((?!mail/config-v1\\.1\\.xml$).*)",
        has: [{ type: "host", value: "autoconfig.tierbase.io" }],
        destination: "https://tierbase.io/:path",
        permanent: true,
      },
    ];
  },
  images: {
    unoptimized: true,
    remotePatterns: [
      { protocol: "https", hostname: "s4.anilist.co" },
      { protocol: "https", hostname: "images.igdb.com" },
    ],
  },
};

export default nextConfig;
