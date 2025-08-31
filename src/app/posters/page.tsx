// src/app/posters/page.tsx
'use client'

import * as React from 'react'
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
  dataB64?: string
  mime?: string
  filename?: string
}

export default function PostersPage() {
  const [baseFile, setBaseFile] = React.useState<File | null>(null)
  const [loading, setLoading] = React.useState(false)
  const [downloadingZip, setDownloadingZip] = React.useState(false)
  const [items, setItems] = React.useState<PosterItem[]>([])

  // ⬇️ Multi-loading: plusieurs générations en parallèle
  const [generatingIds, setGeneratingIds] = React.useState<string[]>([])

  function addGenerating(id: string) {
    setGeneratingIds((prev) => (prev.includes(id) ? prev : [...prev, id]))
  }
  function removeGenerating(id: string) {
    setGeneratingIds((prev) => prev.filter((x) => x !== id))
  }

  // sécurise un nom de fichier
  function safeName(s: string) {
    return (s || '')
      .replace(/[<>:"/\\|?*\x00-\x1F]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
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

  // Helpers blob → base64 + dataURL
  async function blobToBase64(blob: Blob): Promise<{ b64: string; dataUrl: string; mime: string }> {
    const arrayBuf = await blob.arrayBuffer()
    const bytes = new Uint8Array(arrayBuf)
    let binary = ''
    for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i])
    const b64 = typeof window !== 'undefined' ? btoa(binary) : Buffer.from(bytes).toString('base64')
    const mime = blob.type || 'image/png'
    return { b64, dataUrl: `data:${mime};base64,${b64}`, mime }
  }

  async function urlToBase64(url: string): Promise<{ b64: string; mime: string }> {
    const resp = await fetch(url)
    const blob = await resp.blob()
    const { b64, mime } = await blobToBase64(blob)
    return { b64, mime }
  }

  async function downloadAllPosters() {
    const withUrls = items.filter((i) => i.posterUrl)
    if (withUrls.length === 0) return
    setDownloadingZip(true)
    try {
      const payloadItems: any[] = []
      for (const it of withUrls) {
        const titleBase = safeName(it.title || `row-${it.row}`)
        const isAI = it.source === 'ai'
        const suffix = isAI ? 'IaGenerated' : 'IMDb'

        if (isAI) {
          if (it.dataB64 && it.mime) {
            payloadItems.push({
              imdbId: it.imdbId || undefined,
              title: it.title || undefined,
              dataB64: it.dataB64.startsWith('data:') ? it.dataB64.split(',').pop() : it.dataB64,
              filename: it.filename || `${titleBase} - ${suffix}.png`,
              mime: it.mime,
            })
          } else {
            const { b64, mime } = await urlToBase64(it.posterUrl)
            payloadItems.push({
              imdbId: it.imdbId || undefined,
              title: it.title || undefined,
              dataB64: b64,
              filename: `${titleBase} - ${suffix}.png`,
              mime,
            })
          }
        } else {
          payloadItems.push({
            imdbId: it.imdbId || undefined,
            title: it.title || undefined,
            posterUrl: it.posterUrl,
            filename: `${titleBase} - ${suffix}`, // ext ajouté serveur
          })
        }
      }

      const res = await fetch('/api/posters/zip', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: payloadItems }),
      })
      if (!res.ok) {
        const text = await res.text()
        throw new Error(text || 'ZIP failed')
      }
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = 'posters.zip'
      a.click()
      setTimeout(() => URL.revokeObjectURL(url), 2000)
    } finally {
      setDownloadingZip(false)
    }
  }

  async function handleGenerateAI(it: PosterItem) {
    const id = it.id || String(it.row)
    // si déjà en cours pour cet item, on ignore le re-click
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

      // 2) Overlay côté client
      const finalBlob = await applyTitleOverlayOnClient({
        baseImageBlob: baseBlob,
        title: it.title,
        category: it.genre,
        genreHint: it.genre,
        width: 1024,
        height: 1536,
        gradientRatio: 0.42,
      })

      // 3) Prépare affichage + base64/mime/filename (pour ZIP)
      const objectUrl = URL.createObjectURL(finalBlob)
      const { b64, mime } = await blobToBase64(finalBlob)
      const ext = 'png'
      const base = `${it.imdbId || `row-${it.row}`}${it.title ? ` - ${safeName(it.title)}` : ''}`
      const filename = `${base}.${ext}`

      // ⚠️ écrase l’affichage IMDb par l’IA
      setItems((prev) =>
        prev.map((x) =>
          (x.id || String(x.row)) === id
            ? {
                ...x,
                posterUrl: objectUrl,
                status: 'ok',
                error: undefined,
                source: 'ai',
                dataB64: b64,
                mime,
                filename,
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
