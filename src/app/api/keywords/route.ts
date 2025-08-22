// src/app/api/keywords/route.ts
import { NextRequest } from 'next/server'
import { Workbook } from 'exceljs'
import pLimit from 'p-limit'
import { generateKeywordsForRow } from '@/lib/Keywords/generateKeywords'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

export async function POST(req: NextRequest) {
  const stream = new ReadableStream({
    async start(controller) {
      const enc = new TextEncoder()
      const send = (obj: any) => controller.enqueue(enc.encode(JSON.stringify(obj) + '\n'))
      try {
        const form = await req.formData()
        const enrichedFile = form.get('file') as File | null
        if (!enrichedFile) {
          send({ type: 'error', message: 'Fichier enrichi manquant' })
          controller.close()
          return
        }
        const ab = await enrichedFile.arrayBuffer()
        const wb = new Workbook()
        await wb.xlsx.load(ab)
        const sheet = wb.worksheets[0]
        if (!sheet) throw new Error('Feuille Excel vide')

        const rowOffset = 9
        const lastRow = sheet.rowCount

        const rowsIdx: number[] = []
        for (let i = rowOffset + 1; i <= lastRow; i++) {
          const r = sheet.getRow(i)
          const hasTitle = (r.getCell('B').value ?? '').toString().trim().length > 0
          if (hasTitle) rowsIdx.push(i)
        }

        const total = rowsIdx.length
        send({ type: 'log', level: 'info', message: `Lignes à traiter: ${total}` })
        let done = 0

        const limit = pLimit(Number(process.env.P_LIMIT_KEYWORDS || 12))

        await Promise.all(rowsIdx.map((ri) =>
          limit(async () => {
            try {
              const row = sheet.getRow(ri)
              const title = (row.getCell('B').value ?? '').toString()
              const synopsis = (row.getCell('D').value ?? '').toString()
              const genreStr = (row.getCell('F').value ?? '').toString()
              const directors = (row.getCell('J').value ?? '').toString().split(',').map(s=>s.trim()).filter(Boolean)
              const actors = (row.getCell('K').value ?? '').toString().split(',').map(s=>s.trim()).filter(Boolean)
              const currentKw = (row.getCell('L').value ?? '').toString().split(',').map(s=>s.trim()).filter(Boolean)
              const existingGenres = genreStr.split(',').map(s=>s.trim()).filter(Boolean)

              const finalKw = await generateKeywordsForRow({
                title, synopsis, directors, actors,
                existingGenres,
                existingKeywords: currentKw,
                targetCount: 8,
              })

              row.getCell('L').value = finalKw.join(', ')
              row.commit()

              send({ type: 'log', level: 'info', row: ri, message: `Mots-clé: ${finalKw.join(' | ')}` })
            } catch (e: any) {
              send({ type: 'log', level: 'error', row: ri, message: e?.message || String(e) })
            } finally {
              done++
              const progress = Math.round((done/total)*100)
              send({ type: 'progress', done, total, progress })
            }
          })
        ))

        const outBuf = await wb.xlsx.writeBuffer()
        const b64 = Buffer.from(outBuf).toString('base64')
        send({ type: 'done', fileBase64: b64, filename: 'fichier-keywords.xlsx' })
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
