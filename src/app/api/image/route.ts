// src/app/api/image/route.ts
import { NextRequest } from 'next/server'

export const runtime = 'nodejs'
export const maxDuration = 300

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const src = searchParams.get('src')
    if (!src) return new Response('Missing src', { status: 400 })

    const controller = new AbortController()
    const t = setTimeout(() => controller.abort(), 15_000)

    const upstream = await fetch(src, {
      signal: controller.signal,
      // Optional: Referer/User-Agent custom si besoin
      headers: { 'User-Agent': 'PosterProxy/1.0' },
    }).finally(() => clearTimeout(t))

    if (!upstream.ok || !upstream.body) {
      return new Response('Upstream error', { status: 502 })
    }

    const headers = new Headers(upstream.headers)
    headers.set('Cache-Control', 'public, max-age=604800, immutable') // 7 jours
    headers.delete('set-cookie')

    return new Response(upstream.body, { status: 200, headers })
  } catch (e: any) {
    const status = e?.name === 'AbortError' ? 504 : 500
    return new Response(`Proxy error: ${e?.message || 'failed'}`, { status })
  }
}
