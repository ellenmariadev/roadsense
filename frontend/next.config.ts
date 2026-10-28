import type { NextConfig } from 'next';

const apiOrigin = process.env.ROADSENSE_API_URL ?? 'http://127.0.0.1:3000';

const nextConfig: NextConfig = {
  turbopack: {
    root: process.cwd(),
  },
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: `${apiOrigin}/api/:path*`,
      },
    ];
  },
};

export default nextConfig;
