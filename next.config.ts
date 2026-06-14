import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Hide the dev-tools badge (it overlaps the brand/active tab during demos).
  devIndicators: false,
  // Don't fail production builds on lint/type errors (hackathon velocity).
  // We still run `tsc`/eslint locally before committing.
  eslint: { ignoreDuringBuilds: true },
  typescript: { ignoreBuildErrors: true },
};

export default nextConfig;
