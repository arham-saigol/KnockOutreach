import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  reactStrictMode: true,
  allowedDevOrigins: ["127.0.0.1"],
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "ph-files.imgix.net" },
      { protocol: "https", hostname: "api.producthunt.com" },
    ],
  },
};

export default nextConfig;
