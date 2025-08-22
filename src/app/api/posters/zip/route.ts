// src/app/api/posters/zip/route.ts
import { NextRequest } from 'next/server'
import pLimit from 'p-limit'
import archiver from 'archiver'
import { Readable as NodeReadable } from 'stream'
import type { Readable as ReadableType } from 'stream'
import type { ReadableStream as WebReadableStream } from 'stream/web'

export const runtime = 'nodejs'
export const maxDuration = 300
export const dynamic = 'force-dynamic'

type Item = {
  imdbId?: string
  title?: string
  posterUrl?: string   // URL distante
  dataB64?: string     // image inline en base64
  filename?: string    // nom conseillé (avec ou sans extension)
  mime?: string        // MIME connu côté client
}

function safeName(s: string) {
  return s.replace(/[<>:"/\\|?*\x00-\x1F]/g, ' ').replace(/\s+/g, ' ').trim()
}
function hasExt(name?: string) {
  return !!name && /\.[A-Za-z0-9]{2,5}$/.test(name)
}
function ensureExt(nameBase: string, ext: string) {
  return hasExt(nameBase) ? nameBase : `${nameBase}.${ext}`
}
function guessExtFromMime(mime?: string) {
  if (!mime) return 'bin'
  const m = mime.toLowerCase()
  if (m.includes('jpeg') || m.includes('jpg')) return 'jpg'
  if (m.includes('png')) return 'png'
  if (m.includes('webp')) return 'webp'
  return 'bin'
}

async function fetchWithTimeout(url: string, ms = 20_000, retries = 2): Promise<Response> {
  for (let attempt = 0; attempt <= retries; attempt++) {
    const controller = new AbortController()
    const t = setTimeout(() => controller.abort(), ms)
    try {
      const r = await fetch(url, {
        signal: controller.signal,
        headers: { 'User-Agent': 'PosterZip/1.0' },
      })
      clearTimeout(t)
      if (r.ok && r.body) return r
    } catch {
      clearTimeout(t)
    }
    if (attempt === retries) throw new Error('fetch failed')
    await new Promise((res) => setTimeout(res, 500 * (attempt + 1)))
  }
  throw new Error('unreachable')
}

function toNodeReadable(web: globalThis.ReadableStream<Uint8Array>): ReadableType {
  return NodeReadable.fromWeb(web as unknown as WebReadableStream) as unknown as ReadableType
}

export async function POST(req: NextRequest) {
  try {
    const { items } = (await req.json()) as { items: Item[] }
    if (!Array.isArray(items) || items.length === 0) {
      return new Response('No items', { status: 400 })
    }

    const limit = pLimit(Number(process.env.P_LIMIT_DOWNLOAD || 6))
    const archive = archiver('zip', { zlib: { level: 6 } })

    archive.on('warning', (err: Error) => console.warn('archiver warning:', err.message))
    archive.on('error', (err: Error) => console.error('archiver error:', err.message))

    const addTasks = items.map((it, idx) =>
      limit(async () => {
        try {
          // ① INLINE (base64)
          if (it.dataB64) {
            const base = it.dataB64.split(',').pop() || it.dataB64
            const buf = Buffer.from(base, 'base64')
            const extFromMime = guessExtFromMime(it.mime)
            const defaultBase = `${it.imdbId || `row-${idx + 1}`}${it.title ? ` - ${safeName(it.title)}` : ''}`
            const nameBase = it.filename || defaultBase
            const name = ensureExt(nameBase, extFromMime)
            archive.append(buf, { name })
            return
          }

          // ② URL distante
          if (it.posterUrl) {
            const r = await fetchWithTimeout(it.posterUrl)
            const ct = r.headers.get('content-type') || it.mime || 'application/octet-stream'
            const extFromMime = guessExtFromMime(ct)
            const defaultBase = `${it.imdbId || `row-${idx + 1}`}${it.title ? ` - ${safeName(it.title)}` : ''}`
            const nameBase = it.filename || defaultBase
            const name = ensureExt(nameBase, extFromMime)

            const bodyWeb = r.body as unknown as globalThis.ReadableStream<Uint8Array>
            const nodeStream = toNodeReadable(bodyWeb)
            archive.append(nodeStream as any, { name })
          }
        } catch {
          // on ignore l'item en erreur
        }
      })
    )

    const webStream = new ReadableStream<Uint8Array>({
      start(controller) {
        archive.on('data', (chunk: Buffer) => controller.enqueue(new Uint8Array(chunk)))
        archive.on('end', () => controller.close())
        archive.on('error', (err: Error) => controller.error(err))

        ;(async () => {
          try {
            await Promise.all(addTasks)
            await archive.finalize()
          } catch (e) {
            controller.error(e as Error)
          }
        })()
      },
      cancel() {
        try { archive.abort() } catch {}
      },
    })

    archive.resume()

    const headers = new Headers()
    headers.set('Content-Type', 'application/zip')
    headers.set('Content-Disposition', `attachment; filename="posters.zip"`)
    headers.set('Cache-Control', 'no-store')

    return new Response(webStream, { headers })
  } catch (e: any) {
    return new Response(`ZIP error: ${e?.message || 'failed'}`, { status: 500 })
  }
}
