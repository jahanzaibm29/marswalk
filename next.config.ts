import type { NextConfig } from "next";

// Fully static export: deployable to Cloudflare Pages with no server.
const nextConfig: NextConfig = {
  output: "export",
  trailingSlash: true,
  images: {
    unoptimized: true,
  },
};

export default nextConfig;
