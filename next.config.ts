// next.config.ts
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Let builds succeed even if ESLint finds issues
  eslint: {
    ignoreDuringBuilds: true,
  },
};

export default nextConfig;
