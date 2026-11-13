import path from "node:path";
import type { NextConfig } from "next";

// Fully static export: deployed to Cloudflare Workers static assets (see wrangler.jsonc).
const nextConfig: NextConfig = {
  output: "export",
  trailingSlash: true,
  images: {
    unoptimized: true,
  },
  webpack: (config) => {
    // Cesium's splat decoder embeds WASM that the minifier turns into invalid JS.
    config.resolve.alias = {
      ...config.resolve.alias,
      "@spz-loader/core$": path.resolve(__dirname, "src/lib/stubs/spz-loader.ts"),
    };
    return config;
  },
};

export default nextConfig;
