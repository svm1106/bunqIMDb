// src/app/api/posters/proxy/route.ts
import { NextRequest } from 'next/server'

export const runtime = 'nodejs'
export const maxDuration = 60

export async function GET(req: NextRequest) {
  try {
    const url = req.nextUrl.searchParams.get('url')
    if (!url) return new Response('Missing url', { status: 400 })

    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 20_000)

    const r = await fetch(url, {
      signal: controller.signal,
      headers: { 'User-Agent': 'PosterProxy/1.0' },
    }).finally(() => clearTimeout(timeout))

    if (!r.ok || !r.body) {
      return new Response('Fetch failed', { status: 502 })
    }

    const headers = new Headers()
    headers.set('Content-Type', r.headers.get('content-type') || 'application/octet-stream')
    headers.set('Cache-Control', 'no-store')

    return new Response(r.body, { headers })
  } catch (e: any) {
    return new Response(`Proxy error: ${e?.message || 'failed'}`, { status: 500 })
  }
}
