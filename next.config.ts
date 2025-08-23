// next.config.ts
import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  // Lint non bloquant en CI, mais on garde TypeScript strict
  eslint: { ignoreDuringBuilds: true },
  typescript: { ignoreBuildErrors: false },

  // ✅ Empaquette node_modules nécessaires (sharp, archiver, etc.) dans la lambda
  output: 'standalone',

  experimental: {
    // ✅ Force l’inclusion de ces paquets côté serveur (API routes / RSC)
    serverComponentsExternalPackages: ['sharp', 'archiver'],
  },
}

export default nextConfig
