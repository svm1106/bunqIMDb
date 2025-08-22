// src/app/api/posters/resolve/route.ts
import { NextRequest } from 'next/server'
import pLimit from 'p-limit'
import { Workbook } from 'exceljs'
import { getIMDbIdFromRow } from '@/lib/getIMDbIdFromRow'
import { queryImdbGraphQL } from '@/lib/imdbADX'

export const runtime = 'nodejs'
export const maxDuration = 300
export const preferredRegion = ['iad1']

// ---------------------------------------------------------------------------
// Config (env avec valeurs par défaut "safe" pour Vercel)
// ---------------------------------------------------------------------------
const P_LIMIT = Number(process.env.P_LIMIT || 6)               // concurrence IMDb
const RETRIES = Number(process.env.IMDB_RETRIES || 4)          // nb retries 429/5xx
const TIMEOUT_MS = Number(process.env.IMDB_TIMEOUT_MS || 8000) // timeout par appel
const STOP_AFTER_EMPTY = Number(process.env.EMPTY_ROWS_BREAK || 20) // stop si X lignes vides d'affilée

// ---------------------------------------------------------------------------

const POSTER_QUERY = `
  query($id: ID!) {
    title(id: $id) {
      id
      titleText { text }
      primaryImage { url }
    }
  }
`

// ---- helpers ---------------------------------------------------------------

function toStr(v: unknown) {
  return v == null ? '' : String((v as any).text ?? v).trim()
}
function toYear(v: unknown): number | string {
  const s = toStr(v)
  if (/^\d{4}$/.test(s)) return parseInt(s, 10)
  return s
}

// Récupère l'index de colonne par nom d'entête (insensible à la casse).
function resolveColIndex(
  headerRow: import('exceljs').Row | undefined,
  names: string[],
  fallbackIndex: number
): number {
  if (!headerRow) return fallbackIndex
  const max = headerRow.cellCount
  const lowerTargets = names.map((n) => n.toLowerCase())
  for (let i = 1; i <= max; i++) {
    const val = toStr(headerRow.getCell(i).value).toLowerCase()
    if (val && lowerTargets.includes(val)) return i
  }
  return fallbackIndex
}

// Ligne "vide" (aucune donnée utile ET pas d'IMDb ID)
function isRowEmpty(row: import('exceljs').Row, indices: number[]) {
  for (const idx of indices) {
    if (toStr(row.getCell(idx).value)) return false
  }
  // On vérifie aussi IMDb ID via ta fonction (plus fiable)
  const imdbId = getIMDbIdFromRow(row).imdbId || ''
  return !imdbId
}

// Retry avec backoff exponentiel + jitter pour 429/5xx
async function withRetry<T>(fn: () => Promise<T>, tries = RETRIES, base = 400): Promise<T> {
  let last: any
  for (let i = 0; i < tries; i++) {
    try {
      return await fn()
    } catch (e: any) {
      last = e
      const code = e?.status || e?.code || e?.response?.status
      const retriable = [429, 500, 502, 503, 504].includes(code)
      if (!retriable || i === tries - 1) break
      const delay = base * (2 ** i) + Math.floor(Math.random() * 250)
      await new Promise((r) => setTimeout(r, delay))
    }
  }
  throw last
}

// Timeout "générique" si queryImdbGraphQL n'accepte pas { signal }.
// NOTE: si tu peux passer { signal }, préfère l’abort natif.
async function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  let to: any
  const timeout = new Promise<never>((_, rej) => {
    to = setTimeout(() => rej(Object.assign(new Error('IMDb timeout'), { code: 504 })), ms)
  })
  try {
    return await Promise.race([p, timeout])
  } finally {
    clearTimeout(to)
  }
}

// ---- types -----------------------------------------------------------------

type ResolveItem = {
  row: number
  imdbId: string | null
  title: string
  posterUrl: string
  status: 'ok' | 'noPoster' | 'noImdb' | 'error'
  error?: string

  // champs IA (pass-through)
  id?: string
  synopsis?: string
  language?: string
  genre?: string
  year?: number | string
  keywords?: string
}

// ---------------------------------------------------------------------------
// Route
// ---------------------------------------------------------------------------

export async function POST(req: NextRequest) {
  try {
    const form = await req.formData()
    const baseFile = form.get('baseFile') as File | null
    if (!baseFile) {
      return new Response(JSON.stringify({ error: 'Fichier source manquant' }), { status: 400 })
    }

    const ab = await baseFile.arrayBuffer()
    const wb = new Workbook()
    await wb.xlsx.load(ab)
    const sheet = wb.worksheets[0]
    if (!sheet) {
      return new Response(JSON.stringify({ error: 'Feuille Excel introuvable' }), { status: 400 })
    }

    // Design: entêtes à la ligne 9, données à partir de 10
    const HEADER_ROW = 9
    const DATA_START = 10

    const headerRow = sheet.getRow(HEADER_ROW)

    // Fallback mapping (1-based):
    // A:id(1), B:titre(2), C:langue(3), D:synopsis(4), E:genre(5), H:date(8), L:mots_cles(12)
    const colId       = resolveColIndex(headerRow, ['id', 'identifiant'], 1)
    const colTitle    = resolveColIndex(headerRow, ['title', 'titre', 'program', 'programme'], 2)
    const colLang     = resolveColIndex(headerRow, ['langue', 'language'], 3)
    const colSynopsis = resolveColIndex(headerRow, ['synopsis', 'resume', 'résumé', 'plot'], 4)
    const colGenre    = resolveColIndex(headerRow, ['genre', 'categorie', 'catégorie'], 5)
    const colYear     = resolveColIndex(headerRow, ['annee', 'année', 'date', 'year'], 8)
    const colKeywords = resolveColIndex(headerRow, ['mots_cles', 'mots-clés', 'keywords'], 12)

    const dataCols = [colId, colTitle, colLang, colSynopsis, colGenre, colYear, colKeywords]

    // -----------------------------------------------------------------------
    // DÉDUP + Mémoisation d'appel IMDb par imdbId (une requête par ID unique)
    // -----------------------------------------------------------------------
    const seen = new Map<string, Promise<{ title: string; posterUrl: string }>>()

    async function fetchPoster(imdbId: string) {
      const cached = seen.get(imdbId)
      if (cached) return cached

      const task = withRetry(async () => {
        // Variante 1 (universelle) : timeout par Promise.race
        const p = queryImdbGraphQL<any>(POSTER_QUERY, { id: imdbId })
        const json = await withTimeout(p, TIMEOUT_MS)

        // Variante 2 (si ton queryImdbGraphQL supporte { signal }):
        // const ctrl = new AbortController()
        // const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS)
        // try {
        //   const json = await queryImdbGraphQL<any>(POSTER_QUERY, { id: imdbId }, { signal: ctrl.signal })
        //   ...
        // } finally { clearTimeout(timer) }

        const t = json?.data?.title
        return { title: t?.titleText?.text || '', posterUrl: t?.primaryImage?.url || '' }
      }, RETRIES)

      seen.set(imdbId, task)
      return task
    }

    // Concurrence maîtrisée (plus prudent que 8)
    const limit = pLimit(P_LIMIT)

    // -----------------------------------------------------------------------
    // Boucle avec "arrêt anticipé" si plusieurs lignes vides d'affilée
    // -----------------------------------------------------------------------
    const tasks: Promise<ResolveItem>[] = []
    let emptyStreak = 0

    for (let i = DATA_START; i <= sheet.rowCount; i++) {
      const row = sheet.getRow(i)

      if (isRowEmpty(row, dataCols)) {
        emptyStreak++
        if (emptyStreak >= STOP_AFTER_EMPTY) break
        continue
      }
      emptyStreak = 0

      // Champs pour IA
      const id       = toStr(row.getCell(colId).value)
      const titleX   = toStr(row.getCell(colTitle).value)
      const language = toStr(row.getCell(colLang).value)
      const synopsis = toStr(row.getCell(colSynopsis).value)
      const genre    = toStr(row.getCell(colGenre).value)
      const year     = toYear(row.getCell(colYear).value)
      const keywords = toStr(row.getCell(colKeywords).value)

      // IMDb id
      const imdbId = getIMDbIdFromRow(row).imdbId || null

      if (!imdbId) {
        tasks.push(Promise.resolve({
          row: i,
          imdbId: null,
          title: titleX || '',
          posterUrl: '',
          status: 'noImdb',
          id, synopsis, language, genre, year, keywords,
        }))
        continue
      }

      tasks.push(
        limit(async (): Promise<ResolveItem> => {
          try {
            const { title: titleFromImdb, posterUrl } = await fetchPoster(imdbId)
            const status: ResolveItem['status'] = posterUrl ? 'ok' : 'noPoster'
            return {
              row: i,
              imdbId,
              title: titleFromImdb || titleX || '',
              posterUrl,
              status,
              id, synopsis, language, genre, year, keywords,
            }
          } catch (e: any) {
            const code = e?.status || e?.code || e?.response?.status
            const isRate = [429, 500, 502, 503, 504].includes(code)
            // Fail‑soft : si IMDb fait du throttle/ondule → noPoster, pour laisser l’admin générer en IA.
            if (isRate) {
              return {
                row: i,
                imdbId,
                title: titleX || '',
                posterUrl: '',
                status: 'noPoster',
                id, synopsis, language, genre, year, keywords,
              }
            }
            // Erreur "dure"
            return {
              row: i,
              imdbId,
              title: titleX || '',
              posterUrl: '',
              status: 'error',
              error: e?.message || 'IMDb error',
              id, synopsis, language, genre, year, keywords,
            }
          }
        })
      )
    }

    const items = await Promise.all(tasks)

    return new Response(JSON.stringify({ items }), {
      headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
    })
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e?.message || 'Unknown error' }), { status: 500 })
  }
}
