// src/lib/getProducerSynopsisFromRow.ts
import { Row } from 'exceljs'

const URL_RE = /\bhttps?:\/\/\S+/i
const TT_RE = /tt\d{7,8}/i

function stripHtml(s: string): string {
  // retire tags HTML éventuels et normalise espaces
  return s
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function looksLikeSynopsis(s: string): boolean {
  // rejette URLs pures / IDs / très court / tout en maj + trop de ponctuation suspecte
  if (!s) return false
  if (URL_RE.test(s)) return false
  if (TT_RE.test(s)) return false
  const plain = stripHtml(s)
  if (plain.length < 60) return false // seuil minimal pour éviter les titres/phrases trop courtes
  return true
}

export function getProducerSynopsisFromRow(row: Row, opts?: {
  maxChars?: number
}): string | null {
  const maxChars = opts?.maxChars ?? 2000 // coupe pour éviter d’exploser la colonne

  let best: string | null = null
  let bestLen = 0

  for (const rawCell of (row.values as any[]) ?? []) {
    let candidate: string | null = null

    if (typeof rawCell === 'string') {
      candidate = rawCell
    } else if (rawCell && typeof rawCell === 'object') {
      // ExcelJS peut donner { text, hyperlink, richText, result } etc.
      if (typeof rawCell.text === 'string') candidate = rawCell.text
      else if (typeof rawCell.result === 'string') candidate = rawCell.result
      else if (typeof rawCell.hyperlink === 'string') candidate = rawCell.hyperlink
      else if (Array.isArray(rawCell.richText)) {
        candidate = rawCell.richText.map((r: any) => r?.text ?? '').join('')
      }
    }

    if (typeof candidate === 'string') {
      const cleaned = stripHtml(candidate)
      if (!looksLikeSynopsis(cleaned)) continue

      const len = cleaned.length
      if (len > bestLen) {
        best = cleaned.slice(0, maxChars)
        bestLen = best.length
      }
    }
  }

  return best
}
