// src/lib/keywords/generateKeywords.ts
import OpenAI from 'openai'
import fs from 'fs'
import crypto from 'crypto'
import { cosine, getLibraryEmbeddings, normalizeKeyword, Vec } from './libraryEmbeddings'

const CTX_CACHE = '/tmp/ctx_emb_cache.json' // { [sha1(context)]: Vec }
let ctxCache: Record<string, Vec> | null = null

function getClient(): OpenAI {
  const apiKey = process.env.OPENAI_KEYWORDS_API_KEY
  if (!apiKey) throw new Error('OPENAI_KEYWORDS_API_KEY manquante (env)')
  return new OpenAI({ apiKey })
}

function loadCtxCache() {
  if (!ctxCache && fs.existsSync(CTX_CACHE)) {
    try {
      ctxCache = JSON.parse(fs.readFileSync(CTX_CACHE, 'utf8'))
    } catch {
      ctxCache = {}
    }
  }
  if (!ctxCache) ctxCache = {}
}
function saveCtxCacheSoon() {
  try {
    fs.writeFileSync(CTX_CACHE, JSON.stringify(ctxCache))
  } catch {
    // best-effort
  }
}

// MMR léger pour la diversité
function pickWithMMR(
  candidates: { kw: string; score: number; vec: Vec }[],
  need: number,
  lambda = 0.6
): string[] {
  const chosen: { kw: string; vec: Vec }[] = []
  while (chosen.length < need && candidates.length) {
    let bestIdx = 0
    let bestVal = -Infinity
    for (let i = 0; i < candidates.length; i++) {
      const c = candidates[i]
      let divPenalty = 0
      for (const ch of chosen) divPenalty = Math.max(divPenalty, cosine(c.vec, ch.vec))
      const val = c.score - lambda * divPenalty
      if (val > bestVal) {
        bestVal = val
        bestIdx = i
      }
    }
    chosen.push({ kw: candidates[bestIdx].kw, vec: candidates[bestIdx].vec })
    candidates.splice(bestIdx, 1)
  }
  return chosen.map((x) => x.kw)
}

export async function generateKeywordsForRow(params: {
  title?: string
  synopsis?: string
  directors?: string[]
  actors?: string[]
  existingGenres?: string[]
  existingKeywords?: string[]
  targetCount?: number
}): Promise<string[]> {
  const {
    title = '',
    synopsis = '',
    directors = [],
    actors = [],
    existingGenres = [],
    existingKeywords = [],
    targetCount = 8,
  } = params

  // 0) Dédup normalisée des existants
  const base = new Set<string>()
  for (const g of existingGenres) base.add(normalizeKeyword(g))
  for (const k of existingKeywords) base.add(normalizeKeyword(k))
  if (base.size >= targetCount) return Array.from(base).slice(0, targetCount)

  // 1) Contexte compact (1 seule embedding → coût minimal)
  const context = [
    title,
    synopsis.slice(0, 1500),
    directors.slice(0, 3).join(', '),
    actors.slice(0, 5).join(', '),
  ]
    .filter(Boolean)
    .join('\n')

  const hash = crypto.createHash('sha1').update(context || 'empty').digest('hex')
  loadCtxCache()
  let ctxVec: Vec | null = ctxCache![hash] || null

  const model = 'text-embedding-3-small' // ultra cheap
  if (!ctxVec) {
    const client = getClient()
    const { data } = await client.embeddings.create({ model, input: context || 'empty' })
    ctxVec = data[0].embedding as Vec
    ctxCache![hash] = ctxVec
    saveCtxCacheSoon()
  }

  // 2) Similarité avec la librairie (embeddée une fois, cache mémoire + /tmp)
  const lib = await getLibraryEmbeddings(model) // typé non-null
  const already = new Set(Array.from(base))
  const candidates: { kw: string; score: number; vec: Vec }[] = []
  for (const it of lib.items) {
    if (already.has(it.kw)) continue
    const score = cosine(ctxVec!, it.vec)
    candidates.push({ kw: it.kw, score, vec: it.vec })
  }
  candidates.sort((a, b) => b.score - a.score)

  const need = Math.max(0, targetCount - already.size)
  const picked = pickWithMMR(candidates.slice(0, 60), need, 0.6) // top60 pour perf

  // 3) Ordre final : genres existants → keywords existants → compléments
  const final: string[] = []
  const seen = new Set<string>()

  for (const g of existingGenres.map(normalizeKeyword)) {
    if (!seen.has(g)) {
      final.push(g)
      seen.add(g)
    }
    if (final.length === targetCount) return final
  }
  for (const k of existingKeywords.map(normalizeKeyword)) {
    if (!seen.has(k)) {
      final.push(k)
      seen.add(k)
    }
    if (final.length === targetCount) return final
  }
  for (const n of picked.map(normalizeKeyword)) {
    if (!seen.has(n)) {
      final.push(n)
      seen.add(n)
    }
    if (final.length === targetCount) break
  }

  return final
}
