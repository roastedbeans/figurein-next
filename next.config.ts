import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // Custom icon uploads flow through a server action as multipart FormData.
    // The default 1MB cap rejects even modest PNGs before our optimizer can
    // resize them; 6MB comfortably fits the raw inputs we then compress.
    serverActions: {
      bodySizeLimit: "6mb",
    },
  },
};

export default nextConfig;
