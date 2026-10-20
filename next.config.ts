import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  cacheComponents: true,
  partialPrefetching: true,
  images: {
    unoptimized: true,
    remotePatterns: [{ protocol: "https", hostname: "s4.anilist.co" }],
  },
};

export default nextConfig;
