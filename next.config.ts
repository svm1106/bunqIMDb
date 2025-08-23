// next.config.ts
import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  eslint: { ignoreDuringBuilds: true },
  typescript: { ignoreBuildErrors: false },

  // ✅ Image Optimization côté Vercel (pas besoin de sharp dans ton code)
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'm.media-amazon.com' },
      { protocol: 'https', hostname: 'ia.media-imdb.com' },
      { protocol: 'https', hostname: 'images-na.ssl-images-amazon.com' },
    ],
    formats: ['image/avif', 'image/webp'],
  },

  // (optionnel) garde standalone si tu veux des bundles plus compacts
  output: 'standalone',
}

export default nextConfig
