import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  async rewrites() {
    return [
      {
        source: '/screenshots/:path*',
        destination: '/api/serve/screenshots/:path*',
      },
    ]
  },
};

export default nextConfig;
