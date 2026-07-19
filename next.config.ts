import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        hostname: 'static.zara.net',
      },
    ],
  },
};

export default nextConfig;
