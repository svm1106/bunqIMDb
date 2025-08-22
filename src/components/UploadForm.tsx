// src/app/_components/UploadForm.tsx (remplace ton composant)
'use client'
import React, { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Progress } from '@/components/ui/progress'
import { Switch } from '@/components/ui/switch' // si tu as shadcn switch

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

export default function UploadForm() {
  const [baseFile, setBaseFile] = useState<File | null>(null)
  const [templateFile, setTemplateFile] = useState<File | null>(null)
  const [doKeywords, setDoKeywords] = useState(true)

  const [loading, setLoading] = useState(false)
  const [progress1, setProgress1] = useState(0)
  const [progress2, setProgress2] = useState(0)
  const [eta1, setEta1] = useState<string | null>(null)
  const [eta2, setEta2] = useState<string | null>(null)
  const [resultUrl, setResultUrl] = useState<string | null>(null)
  const [logs, setLogs] = useState<string[]>([])
  const [showDialog, setShowDialog] = useState(false)

  function pushLog(s: string) {
    setLogs((cur) => [...cur, s])
  }

  function blobFromBase64(b64: string, mime: string) {
    const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0))
    return new Blob([bytes], { type: mime })
  }

  async function runEnrich(formData: FormData): Promise<Blob> {
    const startedAt = Date.now()
    let total = 0, done = 0

    await readNdjsonStream(await fetch('/api/enrich', { method: 'POST', body: formData }), (evt) => {
      if (evt.type === 'progress') {
        total = evt.total ?? total
        done  = evt.done ?? done
        const pct = Number(evt.progress) || (total ? Math.round((done/total)*100) : 0)
        setProgress1(pct)
        if (total && done) {
          const elapsed = (Date.now() - startedAt) / 1000
          const rate = done / Math.max(elapsed, 0.001)
          const remaining = Math.max(total - done, 0)
          const sec = rate > 0 ? Math.round(remaining / rate) : 0
          const mm = Math.floor(sec / 60)
          const ss = sec % 60
          setEta1(`${String(mm).padStart(2,'0')}:${String(ss).padStart(2,'0')}`)
        }
      } else if (evt.type === 'log') {
        pushLog(`${(evt.level || 'info').toUpperCase()}${evt.row ? ` [row ${evt.row}]` : ''}: ${evt.message}`)
      } else if (evt.type === 'error') {
        pushLog(`ERROR: ${evt.message}`)
        setShowDialog(true)
      } else if (evt.type === 'done') {
        setProgress1(100); setEta1('00:00')
        pushLog('Enrichissement terminé.')
      }
    })

    // Récupère la dernière ligne done via un second fetch ? Non: on reconstruit via setResultUrl au fil.
    // On retourne le blob reconstruit à partir de la dernière "done" captée :
    // => pour être simple, on refait un petit fetch binaire de l’URL en mémoire si on l’a,
    // mais mieux : stocke le blob localement lorsque "done" arrive.

    // Solution: on relit les logs pour extraire la dernière 'done' ? Trop complexe ici,
    // Donc on redécode le b64 dans le handler "done" directement :

    // On capture le blob enrich dans une variable externe :
    throw new Error('Cette fonction doit être appelée via runPipeline() ci-dessous.')
  }

  async function runPipeline() {
    setLoading(true)
    setResultUrl(null)
    setLogs([])
    setShowDialog(false)
    setProgress1(0); setProgress2(0); setEta1(null); setEta2(null)

    try {
      if (!baseFile || !templateFile) return alert('Veuillez sélectionner deux fichiers')

      // 1) ENRICH
      const form1 = new FormData()
      form1.append('baseFile', baseFile)
      form1.append('templateFile', templateFile)

      const startedAt1 = Date.now()
      let enrichedBlob: Blob | null = null

      await readNdjsonStream(await fetch('/api/enrich', { method: 'POST', body: form1 }), (evt) => {
        if (evt.type === 'progress') {
          const pct = Number(evt.progress) || 0
          setProgress1(pct)
          if (evt.total && evt.done) {
            const elapsed = (Date.now() - startedAt1) / 1000
            const rate = evt.done / Math.max(elapsed, 0.001)
            const remaining = Math.max(evt.total - evt.done, 0)
            const sec = rate > 0 ? Math.round(remaining / rate) : 0
            const mm = Math.floor(sec / 60)
            const ss = sec % 60
            setEta1(`${String(mm).padStart(2,'0')}:${String(ss).padStart(2,'0')}`)
          }
        }
        if (evt.type === 'log') {
          pushLog(`${(evt.level || 'info').toUpperCase()}${evt.row ? ` [row ${evt.row}]` : ''}: ${evt.message}`)
        }
        if (evt.type === 'done') {
          const blob = blobFromBase64(
            evt.fileBase64,
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
          )
          enrichedBlob = blob
          const url = URL.createObjectURL(blob)
          setResultUrl(url) // fichier enrichi (sans keywords) dispo
          setProgress1(100); setEta1('00:00')
          pushLog('Enrichissement terminé.')
        }
        if (evt.type === 'error') {
          pushLog(`ERROR: ${evt.message}`)
          setShowDialog(true)
        }
      })

      if (!enrichedBlob) throw new Error('Enrichissement terminé sans fichier.')

      // 2) KEYWORDS (optionnel)
      if (doKeywords) {
        const form2 = new FormData()
        form2.append('file', new File([enrichedBlob], 'fichier-enrichi.xlsx', {
          type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        }))

        const startedAt2 = Date.now()
        let finalBlob: Blob | null = null

        await readNdjsonStream(await fetch('/api/keywords', { method: 'POST', body: form2 }), (evt) => {
          if (evt.type === 'progress') {
            const pct = Number(evt.progress) || 0
            setProgress2(pct)
            if (evt.total && evt.done) {
              const elapsed = (Date.now() - startedAt2) / 1000
              const rate = evt.done / Math.max(elapsed, 0.001)
              const remaining = Math.max(evt.total - evt.done, 0)
              const sec = rate > 0 ? Math.round(remaining / rate) : 0
              const mm = Math.floor(sec / 60)
              const ss = sec % 60
              setEta2(`${String(mm).padStart(2,'0')}:${String(ss).padStart(2,'0')}`)
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
            setResultUrl(url) // remplace par la version avec keywords
            setProgress2(100); setEta2('00:00')
            pushLog('Complétion des mots‑clé terminée.')
            setShowDialog(true) // affiche le rapport final
          }
          if (evt.type === 'error') {
            pushLog(`ERROR: ${evt.message}`)
            setShowDialog(true)
          }
        })

        if (!finalBlob) throw new Error('Étape keywords terminée sans fichier.')
      } else {
        // Si on ne fait pas les keywords, on montre déjà le rapport enrich
        setShowDialog(true)
      }
    } catch (e: any) {
      console.error(e)
      alert(e?.message || 'Erreur inconnue')
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <Card className="max-w-xl mx-auto mt-10 p-6">
        <CardContent className="space-y-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Switch checked={doKeywords} onCheckedChange={setDoKeywords} id="kw-switch" />
              <Label htmlFor="kw-switch">Compléter automatiquement les mots‑clé (8 au total)</Label>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="baseFile">Fichier source (producteur)</Label>
            <Input id="baseFile" type="file" accept=".xlsx"
                   onChange={(e) => setBaseFile(e.target.files?.[0] || null)} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="templateFile">Fichier template (pour enrich)</Label>
            <Input id="templateFile" type="file" accept=".xlsx"
                   onChange={(e) => setTemplateFile(e.target.files?.[0] || null)} />
          </div>

          <Button onClick={runPipeline} disabled={loading || !baseFile || !templateFile} className="w-full">
            {loading ? 'Traitement…' : 'Lancer'}
          </Button>

          {/* Progress Enrich */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span>Enrichissement</span>
              <span className="tabular-nums">{progress1}% {eta1 ? `• ETA ${eta1}` : ''}</span>
            </div>
            <Progress value={progress1} className="h-2" />
          </div>

          {/* Progress Keywords */}
          {doKeywords && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span>Mots‑clé</span>
                <span className="tabular-nums">{progress2}% {eta2 ? `• ETA ${eta2}` : ''}</span>
              </div>
              <Progress value={progress2} className="h-2" />
            </div>
          )}

          {resultUrl && (
            <div className="text-center">
              <a href={resultUrl} download={doKeywords ? 'fichier-keywords.xlsx' : 'fichier-enrichi.xlsx'}
                 className="text-blue-600 underline">
                Télécharger le fichier {doKeywords ? 'avec mots‑clé' : 'enrichi'}
              </a>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Rapport de traitement</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 text-sm">
            {logs.length === 0 && <p className="text-muted-foreground">Aucun log pour l’instant.</p>}
            {logs.map((entry, index) => (
              <div key={index} className="border p-3 rounded-md shadow-sm bg-muted/30 space-y-1">
                <p className="text-gray-700">{entry}</p>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
