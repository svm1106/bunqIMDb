// src/app/api/thumb/route.ts
import { NextRequest } from 'next/server'
import sharp from 'sharp'

export const runtime = 'nodejs'
export const maxDuration = 60
export const preferredRegion = ['cdg1'] // optionnel : proche de Paris

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
    function redirectToSource(src: string) {
      return new Response(null, {
        status: 302,
        headers: { Location: src, 'Cache-Control': 'no-store' },
      })
    }
  
    try {
      const { searchParams } = new URL(req.url)
      const src = searchParams.get('src')
      const w = Math.max(1, parseInt(searchParams.get('w') || '128', 10))
      const h = Math.max(1, parseInt(searchParams.get('h') || '192', 10))
      const fmt = (searchParams.get('format') || 'webp').toLowerCase()
  
      const fitParam = (searchParams.get('fit') || 'cover').toLowerCase()
      const fit: 'cover' | 'contain' | 'inside' =
        (['cover', 'contain', 'inside'].includes(fitParam) ? fitParam : 'cover') as
          'cover' | 'contain' | 'inside'
      const bg = parseHexColor(searchParams.get('bg') || '')
      const q = Math.max(40, Math.min(95, parseInt(searchParams.get('q') || '78', 10)))
  
      if (!src) return new Response('Missing src', { status: 400 })
      if (!/^https?:\/\//i.test(src)) return new Response('Invalid src', { status: 400 })
      if (!isAllowed(src)) return redirectToSource(src)
  
      const ctrl = new AbortController()
      const t = setTimeout(() => ctrl.abort(), 15_000)
      const r = await fetch(src, {
        signal: ctrl.signal,
        headers: {
          // UA “navigateur” + Accept images : réduit les anti‑bot/CDN HTML
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
            '(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
          'Accept': 'image/avif,image/webp,image/apng,image/*,*/*;q=0.8',
        },
      }).catch((e) => {
        console.error('thumb fetch error', { src, err: String(e) })
        return null as any
      })
      clearTimeout(t)
  
      if (!r?.ok || !r.body) {
        console.warn('thumb upstream not ok/body', { src, status: r?.status })
        return redirectToSource(src)
      }
  
      // ✅ Refuse les “faux 200” (HTML/0 octet) AVANT d’appeler sharp
      const ct = (r.headers.get('content-type') || '').toLowerCase()
      const cl = Number(r.headers.get('content-length') || '0')
      if (!ct.startsWith('image/') || cl === 0) {
        console.warn('thumb non-image response, redirecting', { src, ct, cl })
        return redirectToSource(src)
      }
  
      const buf = Buffer.from(await r.arrayBuffer())
  
      const base = sharp(buf).resize(w, h, {
        fit,
        position: 'attention',
        background: bg,
      })
  
      let outBuf: Buffer
      let ctype: string
      if (fmt === 'jpeg' || fmt === 'jpg') {
        outBuf = await base.jpeg({ quality: q }).toBuffer()
        ctype = 'image/jpeg'
      } else if (fmt === 'png') {
        outBuf = await base.png({ compressionLevel: 6 }).toBuffer()
        ctype = 'image/png'
      } else {
        outBuf = await base.webp({ quality: q }).toBuffer()
        ctype = 'image/webp'
      }
  
      const bytes = new Uint8Array(outBuf)
      const ab = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength)
  
      return new Response(ab as ArrayBuffer, {
        status: 200,
        headers: {
          'Content-Type': ctype,
          'Cache-Control': 'public, max-age=86400, s-maxage=86400, stale-while-revalidate=86400',
        },
      })
    } catch (e) {
      const { searchParams } = new URL(req.url)
      const src = searchParams.get('src') || ''
      console.error('thumb fatal error', { src, err: e instanceof Error ? e.message : String(e) })
      if (src) return new Response(null, { status: 302, headers: { Location: src } })
      return new Response('Thumb error', { status: 500 })
    }
}  
