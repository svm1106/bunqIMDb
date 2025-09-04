//src/app/api/keywords-only/route.ts
import { NextRequest } from 'next/server'
import { Workbook } from 'exceljs'
import pLimit from 'p-limit'
import { generateKeywordsForRow } from '@/lib/Keywords/generateKeywords'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

// Paramètres de ton template (identiques à tes autres routes)
const rowOffset = 9  // première ligne data = 10
const COLS = ['B','C','D','E','F','G','H','I','J','K','L'] as const

type Values = { [K in typeof COLS[number]]?: string }

export async function POST(req: NextRequest) {
  const stream = new ReadableStream({
    async start(controller) {
      const enc = new TextEncoder()
      const send = (obj: any) => controller.enqueue(enc.encode(JSON.stringify(obj) + '\n'))

      try {
        const form = await req.formData()
        const sourceEnriched = form.get('sourceEnriched') as File | null
        const targetBlank    = form.get('targetBlank') as File | null
        const overwriteExistingKw = String(form.get('overwriteExistingKw') || 'true') === 'true'

        if (!sourceEnriched || !targetBlank) {
          send({ type: 'error', message: 'Fichiers manquants (source enrichie + template vierge).' })
          controller.close(); return
        }

        const [srcAb, dstAb] = await Promise.all([sourceEnriched.arrayBuffer(), targetBlank.arrayBuffer()])
        const srcWb = new Workbook(), dstWb = new Workbook()
        await srcWb.xlsx.load(srcAb)
        await dstWb.xlsx.load(dstAb)
        const srcSheet = srcWb.worksheets[0]
        const dstSheet = dstWb.worksheets[0]
        if (!srcSheet || !dstSheet) throw new Error('Feuille Excel introuvable.')

        // On ne touche PAS au style du template destination : on écrit juste les valeurs
        // et on force le wrap sur B & D + hauteur auto.
        dstSheet.getColumn('B').alignment = { ...(dstSheet.getColumn('B').alignment || {}), wrapText: true, vertical: 'top' }
        dstSheet.getColumn('D').alignment = { ...(dstSheet.getColumn('D').alignment || {}), wrapText: true, vertical: 'top' }

        // 1) Lister les lignes non vides côté source (titre en B)
        const lastSrcRow = srcSheet.rowCount
        const srcRows: number[] = []
        for (let i = rowOffset + 1; i <= lastSrcRow; i++) {
          const r = srcSheet.getRow(i)
          const hasTitle = (r.getCell('B').value ?? '').toString().trim().length > 0
          if (hasTitle) srcRows.push(i)
        }

        const total = srcRows.length
        let done = 0
        send({ type: 'log', level: 'info', message: `Lignes source détectées: ${total}` })
        send({ type: 'progress', done, total, progress: 0 })

        const limit = pLimit(Number(process.env.P_LIMIT_KEYWORDS_ONLY || 12))

        await Promise.all(srcRows.map((srcRowIndex, idx) =>
          limit(async () => {
            const dstRowIndex = rowOffset + 1 + idx
            const srcRow = srcSheet.getRow(srcRowIndex)
            const dstRow = dstSheet.getRow(dstRowIndex)

            try {
              // 2) Copier les valeurs (B→L) (sans copier les styles)
              const vals: Values = {} 
              for (const col of COLS) {
                const v = srcRow.getCell(col).value
                vals[col] = v == null ? '' : (typeof v === 'string' ? v : (v as any)?.text ?? String(v))
              }

              // Écrit B→K (on traitera L juste après pour gérer la génération)
              for (const col of COLS) {
                if (col === 'L') continue
                dstRow.getCell(col).value = vals[col] ?? ''
              }

              // 3) Génération des mots-clé (toujours OU seulement si vide selon option)
              const title = (vals.B || '').toString()
              const synopsis = (vals.D || '').toString()
              const directors = (vals.J || '').split(',').map(s=>s.trim()).filter(Boolean)
              const actors = (vals.K || '').split(',').map(s=>s.trim()).filter(Boolean)
              const existingGenres = (vals.F || '').split(',').map(s=>s.trim()).filter(Boolean)
              const currentKw = (vals.L || '').split(',').map(s=>s.trim()).filter(Boolean)

              const mustGenerate = overwriteExistingKw || currentKw.length === 0
              let finalKw = currentKw
              if (mustGenerate) {
                finalKw = await generateKeywordsForRow({
                  title, synopsis, directors, actors,
                  existingGenres,
                  existingKeywords: currentKw,
                  targetCount: 8,
                })
              }
              dstRow.getCell('L').value = finalKw.join(', ')

              // 4) Styles cellule (wrap/align) et hauteur auto — SANS toucher aux couleurs/bordures du template
              dstRow.getCell('B').alignment = { ...(dstRow.getCell('B').alignment || {}), wrapText: true, vertical: 'top' }
              dstRow.getCell('D').alignment = { ...(dstRow.getCell('D').alignment || {}), wrapText: true, vertical: 'top' }
              ;(dstRow as any).height = undefined

              dstRow.commit()

              send({ type: 'log', level: 'info', row: dstRowIndex, message: `Copié depuis source ${srcRowIndex} • KW: ${finalKw.join(' | ')}` })
            } catch (e: any) {
              send({ type: 'log', level: 'error', row: dstRowIndex, message: e?.message || String(e) })
            } finally {
              done++
              const progress = Math.round((done/total)*100)
              send({ type: 'progress', done, total, progress })
            }
          })
        ))

        const outBuf = await dstWb.xlsx.writeBuffer()
        const b64 = Buffer.from(outBuf).toString('base64')
        send({ type: 'done', fileBase64: b64, filename: 'keywords-only.xlsx' })
        controller.close()
      } catch (e: any) {
        const msg = e?.message || 'Unknown error'
        const enc2 = new TextEncoder()
        controller.enqueue(enc2.encode(JSON.stringify({ type: 'error', message: msg }) + '\n'))
        controller.close()
      }
    }
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'application/x-ndjson; charset=utf-8',
      'Cache-Control': 'no-store',
    },
  })
}
