// src/app/posters/page.tsx
'use client'

import * as React from 'react'
import JSZip from 'jszip'
import { UploadForPoster } from '@/components/UploadForPoster'
import { PosterDataTable } from '@/components/PosterTableList'
import { applyTitleOverlayOnClient } from '@/lib/clientOverlay'

export type PosterItem = {
  row: number
  imdbId: string | null
  title: string
  posterUrl: string            // http(s) pour IMDb, blob:/data: pour IA
  status: 'ok' | 'noPoster' | 'noImdb' | 'error'
  error?: string

  // champs pour IA
  id?: string
  synopsis?: string
  language?: string
  genre?: string
  year?: number | string
  keywords?: string

  // source pour le nommage / download
  source?: 'imdb' | 'ai'

  // stockés dès la génération IA (pour ZIP)
  dataB64?: string            // peut être "data:image/png;base64,..." ou base64 pur
  mime?: string               // ex: "image/png"
  filename?: string           // ex: "tt1234567 - Title - IaGenerated.png"
}

export default function PostersPage() {
  const [baseFile, setBaseFile] = React.useState<File | null>(null)
  const [loading, setLoading] = React.useState(false)
  const [downloadingZip, setDownloadingZip] = React.useState(false)
  const [items, setItems] = React.useState<PosterItem[]>([])

  // Générations parallèles (plusieurs lignes en "loading")
  const [generatingIds, setGeneratingIds] = React.useState<string[]>([])
  const addGenerating = (id: string) =>
    setGeneratingIds((prev) => (prev.includes(id) ? prev : [...prev, id]))
  const removeGenerating = (id: string) =>
    setGeneratingIds((prev) => prev.filter((x) => x !== id))

  // Helpers
  const safeName = (s: string) =>
    (s || '').replace(/[<>:"/\\|?*\x00-\x1F]/g, ' ').replace(/\s+/g, ' ').trim()

  const extFromMime = (mime?: string) => {
    if (!mime) return 'bin'
    const m = mime.toLowerCase()
    if (m.includes('jpeg') || m.includes('jpg')) return 'jpg'
    if (m.includes('png')) return 'png'
    if (m.includes('webp')) return 'webp'
    return 'bin'
  }

  async function loadPosters() {
    if (!baseFile) return
    setLoading(true)
    try {
      const form = new FormData()
      form.append('baseFile', baseFile)
      const res = await fetch('/api/posters/resolve', { method: 'POST', body: form })
      const json = await res.json()
      if (!res.ok) throw new Error(json?.error || 'Resolve posters failed')

      const list = (Array.isArray(json.items) ? json.items : []).map((it: PosterItem) => ({
        ...it,
        source: it.posterUrl?.startsWith('http') ? 'imdb' : undefined,
      }))

      setItems(list)
    } catch (e) {
      console.error(e)
      alert('Erreur lors du chargement de l’Excel.')
    } finally {
      setLoading(false)
    }
  }

  // Blob → base64
  async function blobToBase64(blob: Blob): Promise<{ b64: string; mime: string }> {
    const arrayBuf = await blob.arrayBuffer()
    const bytes = new Uint8Array(arrayBuf)
    let binary = ''
    for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i])
    const b64 = typeof window !== 'undefined' ? btoa(binary) : Buffer.from(bytes).toString('base64')
    const mime = blob.type || 'application/octet-stream'
    return { b64, mime }
  }

  // Crée UN SEUL ZIP côté client (JSZip) pour tout ce qui est affiché
  async function downloadAllPosters() {
    const toZip = items.filter((i) => i.posterUrl)
    if (!toZip.length) return

    setDownloadingZip(true)
    try {
      const zip = new JSZip()

      for (const it of toZip) {
        const isAI = it.source === 'ai'
        const titleBase = safeName(it.title || `row-${it.row}`)

        if (isAI) {
          // IA prioritaire : on FORCE le suffixe dans le nom, même si it.filename existe déjà
          // (garantie d'avoir "IaGenerated" dans le nom)
          let base64: string
          let mime = it.mime
          if (it.dataB64) {
            base64 = it.dataB64.startsWith('data:') ? it.dataB64.split(',').pop()! : it.dataB64
          } else {
            const resp = await fetch(it.posterUrl)
            const blob = await resp.blob()
            const conv = await blobToBase64(blob)
            base64 = conv.b64
            mime = mime || conv.mime
          }
          const ext = (it.filename?.split('.').pop()) || extFromMime(mime) || 'png'
          const name = `${titleBase} - IaGenerated.${ext}`
          zip.file(name, base64, { base64: true })
        } else {
          // IMDb : on passe par un proxy same-origin pour éviter CORS
          const proxied = `/api/posters/proxy?url=${encodeURIComponent(it.posterUrl)}`
          const resp = await fetch(proxied)
          if (!resp.ok) continue
          const blob = await resp.blob()
          const { b64, mime } = await blobToBase64(blob)
          const ext = extFromMime(mime) || 'jpg'
          const name = `${titleBase} - IMDb.${ext}`
          zip.file(name, b64, { base64: true })
        }
      }

      const zipBlob = await zip.generateAsync({ type: 'blob' })
      const url = URL.createObjectURL(zipBlob)
      const a = document.createElement('a')
      a.href = url
      a.download = 'posters.zip'
      document.body.appendChild(a)
      a.click()
      a.remove()
      setTimeout(() => URL.revokeObjectURL(url), 2000)
    } catch (e) {
      console.error(e)
      alert("Échec de la préparation du ZIP.")
    } finally {
      setDownloadingZip(false)
    }
  }

  async function handleGenerateAI(it: PosterItem) {
    const id = it.id || String(it.row)
    if (generatingIds.includes(id)) return

    try {
      addGenerating(id)

      // 1) Génère l’image IA (PNG brut)
      const res = await fetch('/api/posters/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id,
          title: it.title,
          synopsis: it.synopsis,
          language: it.language,
          genre: it.genre,
          year: it.year,
          keywords: it.keywords,
          nb_images: 1,
        }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        alert(`Erreur: ${err?.error || res.statusText}`)
        return
      }

      const baseBlob = await res.blob()

      // 2) Overlay côté client (titre/gradient)
      const finalBlob = await applyTitleOverlayOnClient({
        baseImageBlob: baseBlob,
        title: it.title,
        category: it.genre,
        genreHint: it.genre,
        width: 1024,
        height: 1536,
        gradientRatio: 0.42,
      })

      // 3) Affichage + base64/mime/filename (pour ZIP client)
      const objectUrl = URL.createObjectURL(finalBlob)
      const conv = await blobToBase64(finalBlob)
      const mime = conv.mime
      const ext = extFromMime(mime) || 'png'
      const titleBase = safeName(it.title || `row-${it.row}`)
      const filename = `${titleBase} - IaGenerated.${ext}`   // ← suffixe dès la génération

      // ⚠️ On ÉCRASE l’affichage (IMDb → IA)
      setItems((prev) =>
        prev.map((x) =>
          (x.id || String(x.row)) === id
            ? {
                ...x,
                posterUrl: objectUrl,
                status: 'ok',
                error: undefined,
                source: 'ai',
                dataB64: conv.b64,
                mime,
                filename, // ← gardé si jamais tu réutilises ailleurs
              }
            : x
        )
      )
    } finally {
      removeGenerating(id)
    }
  }

  return (
    <div className="px-4 py-10 space-y-8">
      <div className="max-w-xl mx-auto">
        <UploadForPoster
          onFileSelected={setBaseFile}
          onSubmit={loadPosters}
          disabled={!baseFile}
          loading={loading}
        />
      </div>

      <div className="max-w-4xl mx-auto mt-10">
        <PosterDataTable
          items={items}
          loading={loading}
          onDownloadAll={downloadAllPosters}
          downloadingZip={downloadingZip}
          onGenerateAI={handleGenerateAI}
          generatingIds={generatingIds}
        />
      </div>
    </div>
  )
}
