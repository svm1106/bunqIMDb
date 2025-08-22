// src/app/api/thumb/route.ts
import { NextRequest } from 'next/server'
import sharp from 'sharp'

export const runtime = 'nodejs'
export const maxDuration = 60

const ALLOWED_HOSTS = new Set([
  'm.media-amazon.com',
  'ia.media-imdb.com',
  'images-na.ssl-images-amazon.com',
])

function isAllowed(urlStr: string) {
  try {
    const u = new URL(urlStr)
    return ALLOWED_HOSTS.has(u.hostname.toLowerCase())
  } catch {
    return false
  }
}

function parseHexColor(hex?: string) {
  if (!hex) return { r: 0, g: 0, b: 0, alpha: 0 }
  const v = hex.replace('#', '')
  const r = parseInt(v.slice(0, 2), 16)
  const g = parseInt(v.slice(2, 4), 16)
  const b = parseInt(v.slice(4, 6), 16)
  const a = v.length >= 8 ? parseInt(v.slice(6, 8), 16) / 255 : 1
  return { r, g, b, alpha: a }
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const src = searchParams.get('src')
    const w = Math.max(1, parseInt(searchParams.get('w') || '128', 10))
    const h = Math.max(1, parseInt(searchParams.get('h') || '192', 10))
    const fmt = (searchParams.get('format') || 'webp').toLowerCase()

    const fitParam = (searchParams.get('fit') || 'cover').toLowerCase()
    const fit = ['cover', 'contain', 'inside'].includes(fitParam) ? (fitParam as 'cover' | 'contain' | 'inside') : 'cover'
    const bg = parseHexColor(searchParams.get('bg') || '')
    const q = Math.max(40, Math.min(95, parseInt(searchParams.get('q') || '78', 10)))

    if (!src) return new Response('Missing src', { status: 400 })
    if (!/^https?:\/\//i.test(src)) return new Response('Invalid src', { status: 400 })
    if (!isAllowed(src)) return new Response('Host not allowed', { status: 403 })

    const ctrl = new AbortController()
    const t = setTimeout(() => ctrl.abort(), 15_000)
    const r = await fetch(src, {
      headers: { 'User-Agent': 'ThumbProxy/1.1' },
      signal: ctrl.signal,
    })
    clearTimeout(t)

    if (!r.ok) return new Response(`Upstream ${r.status}`, { status: 502 })
    const buf = Buffer.from(await r.arrayBuffer())

    const base = sharp(buf).resize(w, h, {
      fit,
      position: 'attention', // 👈 accepte directement une string
      background: bg,
    })

    let out: Buffer
    let ctype: string
    if (fmt === 'jpeg' || fmt === 'jpg') {
      out = await base.jpeg({ quality: q }).toBuffer()
      ctype = 'image/jpeg'
    } else if (fmt === 'png') {
      out = await base.png({ compressionLevel: 6 }).toBuffer()
      ctype = 'image/png'
    } else {
      out = await base.webp({ quality: q }).toBuffer()
      ctype = 'image/webp'
    }

    return new Response(out, {
      status: 200,
      headers: {
        'Content-Type': ctype,
        'Cache-Control': 'public, max-age=86400, s-maxage=86400, stale-while-revalidate=86400',
      },
    })
  } catch (e: any) {
    return new Response(`Thumb error: ${e?.message || 'failed'}`, { status: 500 })
  }
}
