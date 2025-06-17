import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  eslint: {
    ignoreDuringBuilds: true, // ✅ This disables lint errors from breaking your build
  },
  // other config options here
};

export default nextConfig;
