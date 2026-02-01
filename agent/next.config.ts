import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // TODO: When adding Node-only deps (native or non-bundlable), list them here for server externals.
  serverExternalPackages: ["pino"],
  env: {
    NEXT_PUBLIC_LOG_LEVEL: process.env.LOG_LEVEL,
  },
};

export default nextConfig;
