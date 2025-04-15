/** @type {import('next').NextConfig} */
const nextConfig = {
  // Configure 'next/image' for external images
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'images.pokemontcg.io',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'placehold.co',
        port: '',
        pathname: '/**',
      },
    ],
    unoptimized: true, // For dynamic image dimensions
  },
  // Disable public directories
  skipTrailingSlashRedirect: true,
  skipMiddlewareUrlNormalize: true,
  // Enable webpack optimization
  webpack: (config) => {
    return config;
  },
  // Disable ESLint during builds
  eslint: {
    ignoreDuringBuilds: true,
  },
  // Disable TypeScript checking during builds
  typescript: {
    ignoreBuildErrors: true
  },
  // Development settings
  experimental: {
    allowedDevOrigins: [
      "http://localhost:3000",
      "http://127.0.0.1:3000",
      "http://192.168.0.80:3000"
    ]
  }
};

module.exports = nextConfig; 