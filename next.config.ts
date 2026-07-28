import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Sharp is a native dependency; keep it external to the server bundle.
  serverExternalPackages: ["sharp"],
};

export default nextConfig;
