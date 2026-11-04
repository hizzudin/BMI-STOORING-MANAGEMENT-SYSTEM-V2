import type { NextConfig } from 'next';

const nextConfig: NextConfig = { transpilePackages: ['@bmi/shared', '@bmi/api-client'] };

export default nextConfig;
