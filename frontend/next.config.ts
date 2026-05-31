import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Self-contained server build for container/Railway deploys.
  output: "standalone",
};

export default nextConfig;
