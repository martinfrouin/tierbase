import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  // The home page now shows the recommendations
  async redirects() {
    return [{ source: "/for-you", destination: "/", permanent: true }];
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
