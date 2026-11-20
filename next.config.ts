import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  cacheComponents: true,
  // The dev badge sits over the sticky bottom bar on a phone-width screen.
  devIndicators: false,
  partialPrefetching: true,
  // The AI routes read the prompt .md files at runtime, so ship them with the functions.
  outputFileTracingIncludes: {
    "/api/*": ["./prompts/**/*"],
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
