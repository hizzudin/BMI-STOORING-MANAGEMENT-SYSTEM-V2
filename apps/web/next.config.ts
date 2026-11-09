import type { NextConfig } from 'next';

const LOCAL_API_URL = 'http://localhost:3001';

const nextConfig: NextConfig = {
  transpilePackages: ['@bmi/shared', '@bmi/api-client'],
  // design.md 5.1: the API is reached on the web app's own origin, so its cookies stay HttpOnly and SameSite=Strict.
  async rewrites() {
    return [
      { source: '/api/:path*', destination: `${process.env.API_URL ?? LOCAL_API_URL}/:path*` },
    ];
  },
};

export default nextConfig;
