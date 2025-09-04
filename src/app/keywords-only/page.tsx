//src/app/keywords-only/page.tsx

'use client'
import React, { useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Progress } from '@/components/ui/progress'

type NdjsonHandler = (evt: any) => void

async function readNdjsonStream(res: Response, onEvent: NdjsonHandler) {
  if (!res.ok || !res.body) throw new Error('Réponse non OK')
  const reader = res.body.getReader()
  const decoder = new TextDecoder('utf-8')
  let buffer = ''
  while (true) {
    const { value, done } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    let idx
    while ((idx = buffer.indexOf('\n')) >= 0) {
      const line = buffer.slice(0, idx).trim()
      buffer = buffer.slice(idx + 1)
      if (!line) continue
      try { onEvent(JSON.parse(line)) } catch {}
    }
  }
}

function blobFromBase64(b64: string, mime: string) {
  const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0))
  return new Blob([bytes], { type: mime })
}

export default function KeywordsOnlyPage() {
  // A = template déjà enrichi (source), B = template vierge (destination)
  const [sourceEnriched, setSourceEnriched] = useState<File | null>(null)
  const [targetBlank, setTargetBlank] = useState<File | null>(null)

  const [loading, setLoading] = useState(false)
  const [progress, setProgress] = useState(0)
  const [eta, setEta] = useState<string | null>(null)
  const [resultUrl, setResultUrl] = useState<string | null>(null)
  const [logs, setLogs] = useState<string[]>([])
  const [showDialog, setShowDialog] = useState(false)

  function pushLog(s: string) { setLogs((cur) => [...cur, s]) }

  async function run() {
    setLoading(true)
    setProgress(0); setEta(null); setResultUrl(null)
    setLogs([]); setShowDialog(false)

    try {
      if (!sourceEnriched || !targetBlank) {
        alert('Sélectionne les deux fichiers : (A) template enrichi + (B) template vierge.')
        return
      }

      const form = new FormData()
      form.append('sourceEnriched', sourceEnriched)
      form.append('targetBlank', targetBlank)

      const startedAt = Date.now()
      let finalBlob: Blob | null = null

      await readNdjsonStream(await fetch('/api/keywords-only', { method: 'POST', body: form }), (evt) => {
        if (evt.type === 'progress') {
          const pct = Number(evt.progress) || 0
          setProgress(pct)
          if (evt.total && evt.done) {
            const elapsed = (Date.now() - startedAt) / 1000
            const rate = evt.done / Math.max(elapsed, 0.001)
            const remaining = Math.max(evt.total - evt.done, 0)
            const sec = rate > 0 ? Math.round(remaining / rate) : 0
            const mm = Math.floor(sec / 60), ss = sec % 60
            setEta(`${String(mm).padStart(2,'0')}:${String(ss).padStart(2,'0')}`)
          }
        }
        if (evt.type === 'log') {
          pushLog(`${(evt.level || 'info').toUpperCase()}${evt.row ? ` [row ${evt.row}]` : ''}: ${evt.message}`)
        }
        if (evt.type === 'done') {
          finalBlob = blobFromBase64(
            evt.fileBase64,
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
          )
          const url = URL.createObjectURL(finalBlob)
          setResultUrl(url)
          setProgress(100); setEta('00:00')
          pushLog('Copie + complétion des mots-clé terminées.')
          setShowDialog(true)
        }
        if (evt.type === 'error') {
          pushLog(`ERROR: ${evt.message}`); setShowDialog(true)
        }
      })

      if (!finalBlob) throw new Error('Traitement terminé sans fichier.')
    } catch (e: any) {
      console.error(e)
      alert(e?.message || 'Erreur inconnue')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="container mx-auto max-w-xl py-8">
      <Card>
        <CardContent className="space-y-5 p-6">
          <div className="space-y-2">
            <h1 className="text-xl font-semibold">Keywords Only</h1>
            <p className="text-sm text-muted-foreground">
              ⚠️ Uploade un <b>template déjà enrichi</b> (source), puis ton <b>template vierge</b> (destination).<br />
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="src">Fichier A — Template déjà enrichi (source)</Label>
            <Input id="src" type="file" accept=".xlsx" onChange={(e)=>setSourceEnriched(e.target.files?.[0] || null)} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="dst">Fichier B — Template vierge (destination)</Label>
            <Input id="dst" type="file" accept=".xlsx" onChange={(e)=>setTargetBlank(e.target.files?.[0] || null)} />
          </div>

          <Button className="w-full" disabled={loading || !sourceEnriched || !targetBlank} onClick={run}>
            {loading ? 'Traitement…' : 'Lancer Keywords Only'}
          </Button>

          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span>Progression</span>
              <span className="tabular-nums">{progress}% {eta ? `• ETA ${eta}` : ''}</span>
            </div>
            <Progress value={progress} className="h-2" />
          </div>

          {resultUrl && (
            <div className="text-center">
              <a href={resultUrl} download="keywords-only.xlsx" className="text-blue-600 underline">
                Télécharger le fichier (Keywords Only)
              </a>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Rapport Keywords Only</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 text-sm">
            {logs.length === 0 && <p className="text-muted-foreground">Aucun log pour l’instant.</p>}
            {logs.map((entry, i) => (
              <div key={i} className="border p-3 rounded-md bg-muted/30">{entry}</div>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
