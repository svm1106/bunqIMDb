// src/app/api/enrich/route.ts
import { NextRequest } from 'next/server'
import { Workbook } from 'exceljs'
import pLimit from 'p-limit'
import { enrichIMDB } from '@/lib/enrichIMDB'
import { getIMDbIdFromRow } from '@/lib/getIMDbIdFromRow'
import { getProducerSynopsisFromRow } from '@/lib/getProducerSynopsisFromRow'

export const runtime = 'nodejs'
export const maxDuration = 300
export const dynamic = 'force-dynamic'
// (facultatif, recommandé) proche d’IMDb/AWS us-east-1
export const preferredRegion = ['iad1']

// ---- Config tunable via env
const P_LIMIT_ENRICH = Number(process.env.P_LIMIT_ENRICH || process.env.P_LIMIT || 6)
const STOP_AFTER_EMPTY = Number(process.env.EMPTY_ROWS_BREAK || 20)

export async function POST(req: NextRequest) {
  const stream = new ReadableStream({
    async start(controller) {
      const enc = new TextEncoder()
      const send = (obj: any) => controller.enqueue(enc.encode(JSON.stringify(obj) + '\n'))
      const sendProgress = (p: { done: number; total: number; phase: 'scan'|'preload'|'write' }) => {
        const progress = p.total ? Math.max(0, Math.min(100, Math.round((p.done / p.total) * 100))) : 0
        send({ type: 'progress', done: p.done, total: p.total, progress, phase: p.phase })
      }

      try {
        const form = await req.formData()
        const baseFile = form.get('baseFile') as File | null
        const templateFile = form.get('templateFile') as File | null
        if (!baseFile || !templateFile) {
          send({ type: 'error', message: 'Fichiers manquants' })
          controller.close(); return
        }

        const [baseAb, templateAb] = await Promise.all([baseFile.arrayBuffer(), templateFile.arrayBuffer()])
        const baseWb = new Workbook(), templateWb = new Workbook()
        await baseWb.xlsx.load(baseAb)
        await templateWb.xlsx.load(templateAb)
        const baseSheet = baseWb.worksheets[0]
        const targetSheet = templateWb.worksheets[0]
        if (!baseSheet || !targetSheet) {
          send({ type: 'error', message: 'Feuille Excel introuvable' })
          controller.close(); return
        }

        // --- PASS 0 — Scan + dédup + synopsis producteur + arrêt anticipé
        type InputRowInfo = { inputRowIndex: number; imdbId: string | null }
        const inputs: InputRowInfo[] = []
        const firstByImdbId = new Map<string, number>()
        const duplicatesIgnored: number[] = []
        const noIdRows: number[] = []
        const producerSynopsisByRow = new Map<number, string | null>()

        // ton Excel a souvent du design en haut : on commence à 2 (adaptable si besoin)
        let emptyStreak = 0
        for (let i = 2; i <= baseSheet.rowCount; i++) {
          const row = baseSheet.getRow(i)
          const imdbId = getIMDbIdFromRow(row).imdbId || null
          const producerSynopsis = getProducerSynopsisFromRow(row) || null
          producerSynopsisByRow.set(i, producerSynopsis)

          // “vide” = pas d’ID et pas de titre/synopsis… on arrête après STOP_AFTER_EMPTY
          const maybeTitle = String(row.getCell(2).value ?? '').trim()
          const maybeSyn = String(row.getCell(4).value ?? '').trim()
          const isEmpty = !imdbId && !maybeTitle && !maybeSyn
          emptyStreak = isEmpty ? emptyStreak + 1 : 0
          if (emptyStreak >= STOP_AFTER_EMPTY) break

          if (!imdbId) {
            noIdRows.push(i)
            inputs.push({ inputRowIndex: i, imdbId: null })
            continue
          }
          if (!firstByImdbId.has(imdbId)) {
            firstByImdbId.set(imdbId, i)
            inputs.push({ inputRowIndex: i, imdbId })
          } else {
            duplicatesIgnored.push(i)
            send({ type: 'log', level: 'info', row: i, message: `Doublon détecté pour ${imdbId} → ignoré.` })
          }
        }

        // --- PASS 1 — Pré-chargement enrichIMDB (une seule fois par ID)
        const uniqueIds = Array.from(firstByImdbId.keys())
        const limit = pLimit(P_LIMIT_ENRICH)
        const enrichedById = new Map<string, Awaited<ReturnType<typeof enrichIMDB>>>()

        // Progress global : préload + write
        // On calcule un total provisoire (on réajustera après si les saisons >1 gonflent le plan)
        let doneUnits = 0
        let totalUnits = uniqueIds.length /* preloads */ + inputs.length /* min write */
        sendProgress({ done: 0, total: totalUnits, phase: 'scan' })

        await Promise.all(uniqueIds.map((id) =>
          limit(async () => {
            try {
              if (!enrichedById.has(id)) {
                const res = await enrichIMDB(id) // ⚠️ enrichIMDB inclut retry/timeout (voir patch plus bas)
                enrichedById.set(id, res)
              }
            } catch (e: any) {
              enrichedById.set(id, { enriched: null, error: e?.message || String(e), debug: '' } as any)
            } finally {
              doneUnits++
              sendProgress({ done: doneUnits, total: totalUnits, phase: 'preload' })
            }
          })
        ))

        // --- PLAN — construit à partir de seasonCount renvoyé par enrichIMDB
        type PlanItem = { inputRowIndex: number; imdbId: string | null; seasonNumber: number | null; addSeasonSuffix: boolean }
        const plan: PlanItem[] = []
        for (const it of inputs) {
          if (!it.imdbId) {
            plan.push({ inputRowIndex: it.inputRowIndex, imdbId: null, seasonNumber: null, addSeasonSuffix: false })
            continue
          }
          const cached = enrichedById.get(it.imdbId)
          const sc = Math.max(1, Number(cached?.enriched?.seasonCount || 1))
          if (sc <= 1) {
            plan.push({ inputRowIndex: it.inputRowIndex, imdbId: it.imdbId, seasonNumber: 1, addSeasonSuffix: false })
          } else {
            for (let s = 1; s <= sc; s++) {
              plan.push({ inputRowIndex: it.inputRowIndex, imdbId: it.imdbId, seasonNumber: s, addSeasonSuffix: true })
            }
          }
        }

        // Réajuste le total pour le write “réel”
        totalUnits = uniqueIds.length + plan.length
        // On n’efface pas doneUnits (préload déjà accompli)

        // --- PASS 2 — Écriture séquentielle
        const rowOffset = 9
        for (let outIndex = 0; outIndex < plan.length; outIndex++) {
          const p = plan[outIndex]
          const targetRow = targetSheet.getRow(rowOffset + 1 + outIndex)

          try {
            if (!p.imdbId) {
              const producerSyn = producerSynopsisByRow.get(p.inputRowIndex) || ''
              if (producerSyn) {
                send({ type: 'log', level: 'info', row: p.inputRowIndex, message: 'Synopsis producteur utilisé (aucun ID IMDb).' })
              } else {
                send({ type: 'log', level: 'warn', row: p.inputRowIndex, message: 'Aucun ID IMDb et aucun synopsis producteur détecté.' })
              }
              targetRow.getCell('B').value = ''
              targetRow.getCell('C').value = 'Unknown'
              targetRow.getCell('D').value = producerSyn
              targetRow.getCell('E').value = ''
              targetRow.getCell('F').value = ''
              targetRow.getCell('G').value = ''
              targetRow.getCell('H').value = ''
              targetRow.getCell('I').value = ''
              targetRow.getCell('J').value = ''
              targetRow.getCell('K').value = ''
              targetRow.getCell('L').value = ''
              targetRow.commit()
            } else {
              const cached = enrichedById.get(p.imdbId)
              const { enriched, error } = cached || { enriched: null, error: 'cache miss' }
              if (error || !enriched) {
                send({ type: 'log', level: 'error', row: p.inputRowIndex, message: error || 'Enrich failed' })
              }

              const seasonSuffix =
                p.addSeasonSuffix && p.seasonNumber && p.seasonNumber >= 1 ? ` (Saison ${p.seasonNumber})` : ''
              const titleWithSeason = (enriched?.title || '') + seasonSuffix

              const producerSyn = producerSynopsisByRow.get(p.inputRowIndex) || ''
              const chosenSynopsis = producerSyn || (enriched?.synopsis || '')

              if (producerSyn) {
                send({ type: 'log', level: 'info', row: p.inputRowIndex, message: 'Synopsis producteur utilisé (plus long/plus complet).' })
              } else if (enriched?.synopsis) {
                send({ type: 'log', level: 'info', row: p.inputRowIndex, message: 'Synopsis IMDb utilisé (aucun synopsis producteur).' })
              } else {
                send({ type: 'log', level: 'warn', row: p.inputRowIndex, message: 'Aucun synopsis disponible.' })
              }

              const values = {
                B: titleWithSeason,
                C: enriched?.language || 'Unknown',
                D: chosenSynopsis,
                E: enriched?.category || '',
                F: enriched?.genre || '',
                G: p.imdbId ? `https://www.imdb.com/title/${p.imdbId}` : '',
                H: enriched?.year || '',
                I: enriched?.country || '',
                J: (enriched?.directors || []).join(', '),
                K: (enriched?.actors || []).join(', '),
                L: (enriched?.keywords || []).join(', '),
              } as const

              for (const [col, val] of Object.entries(values)) targetRow.getCell(col).value = val as any
              targetRow.commit()
            }
          } catch (e: any) {
            send({ type: 'log', level: 'error', row: p.inputRowIndex, message: e?.message || String(e) })
          } finally {
            doneUnits++
            sendProgress({ done: doneUnits, total: totalUnits, phase: 'write' })
          }
        }

        if (duplicatesIgnored.length > 0) {
          send({ type: 'log', level: 'info', message: `Doublons ignorés (lignes source): ${duplicatesIgnored.join(', ')}` })
        }
        if (noIdRows.length > 0) {
          send({ type: 'log', level: 'warn', message: `Lignes sans IMDb ID (pas d’expansion): ${noIdRows.join(', ')}` })
        }

        const outBuf = await templateWb.xlsx.writeBuffer()
        const b64 = Buffer.from(outBuf).toString('base64')
        send({ type: 'done', fileBase64: b64, filename: 'fichier-enrichi.xlsx' })
        controller.close()
      } catch (e: any) {
        send({ type: 'error', message: e?.message || 'Unknown error' })
        controller.close()
      }
    },
  })

  return new Response(stream, {
    headers: { 'Content-Type': 'application/x-ndjson; charset=utf-8', 'Cache-Control': 'no-store' },
  })
}
