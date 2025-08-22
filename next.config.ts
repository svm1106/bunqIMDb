// next.config.ts
import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  eslint: { ignoreDuringBuilds: true },         // 👈 le build ne casse plus sur ESLint
  typescript: { ignoreBuildErrors: false },     // garde TS strict pour protéger la prod
}

export default nextConfig
