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

  // source pour le nommage
  source?: 'imdb' | 'ai'
}

export default function PostersPage() {
  const [baseFile, setBaseFile] = React.useState<File | null>(null)
  const [loading, setLoading] = React.useState(false)
  const [downloadingZip, setDownloadingZip] = React.useState(false)
  const [items, setItems] = React.useState<PosterItem[]>([])
  const [generatingId, setGeneratingId] = React.useState<string | null>(null)

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

      // Marque source imdb quand posterUrl http(s)
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

  // Convertit une URL (http(s) OU blob:) en base64 + mime
  async function blobUrlToBase64(url: string): Promise<{ b64: string; mime: string }> {
    const resp = await fetch(url)
    const blob = await resp.blob()
    const arrayBuf = await blob.arrayBuffer()
    let binary = ''
    const bytes = new Uint8Array(arrayBuf)
    for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i])
    const b64 = typeof window !== 'undefined' ? btoa(binary) : Buffer.from(bytes).toString('base64')
    return { b64, mime: blob.type || 'application/octet-stream' }
  }

  async function downloadAllPosters() {
    const withUrls = items.filter((i) => i.posterUrl)
    if (withUrls.length === 0) return
    setDownloadingZip(true)
    try {
      const payloadItems: any[] = []
      for (const it of withUrls) {
        const titleBase = safeName(it.title || `row-${it.row}`)
        const url = it.posterUrl
        const isAI = it.source === 'ai' || (!url.startsWith('http://') && !url.startsWith('https://'))
        const suffix = isAI ? 'IaGenerated' : 'IMDb'

        if (url.startsWith('http://') || url.startsWith('https://')) {
          // IMDb → serveur fera fetch; on passe un filename SANS extension (le serveur l’ajoute selon content-type)
          payloadItems.push({
            imdbId: it.imdbId || undefined,
            title: it.title || undefined,
            posterUrl: url,
            filename: `${titleBase} - ${suffix}`, // ext ajouté serveur
          })
        } else {
          // IA (blob:) → on envoie en base64; on sait que c’est un PNG ici
          const { b64, mime } = await blobUrlToBase64(url)
          payloadItems.push({
            imdbId: it.imdbId || undefined,
            title: it.title || undefined,
            dataB64: b64,
            filename: `${titleBase} - ${suffix}.png`, // on fixe .png
            mime,
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
    try {
      const id = it.id || String(it.row)
      setGeneratingId(id)
  
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
  
      // 2) 🔥 Overlay côté client (gradient + titre, 3 lignes max, fonts par catégorie)
      const finalBlob = await applyTitleOverlayOnClient({
        baseImageBlob: baseBlob,
        title: it.title,
        category: it.genre,       // ou passe une vraie catégorie si tu l'as
        genreHint: it.genre,
        width: 1024,
        height: 1536,
        gradientRatio: 0.42,
      })
  
      const url = URL.createObjectURL(finalBlob)
  
      setItems((prev) =>
        prev.map((x) =>
          (x.id || String(x.row)) === id
            ? { ...x, posterUrl: url, status: 'ok', error: undefined, source: 'ai' }
            : x
        )
      )
    } finally {
      setGeneratingId(null)
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
          generatingId={generatingId}
        />
      </div>
    </div>
  )
}
