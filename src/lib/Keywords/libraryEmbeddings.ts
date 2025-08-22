import OpenAI from 'openai'
import fs from 'fs'
import { ALLOWED_KEYWORDS } from './allowedKeywords'

export type Vec = number[]

const TMP_PATH = '/tmp/keywords_library_emb.json'

// On garde un cache mémoire nullable, mais on NE retourne jamais ce type directement.
let inMemory: { items: { kw: string; vec: Vec }[]; model: string } | null = null

export function normalizeKeyword(k: string): string {
  return k.normalize('NFKC').toLowerCase().trim()
}

function getClient(): OpenAI {
  const apiKey = process.env.OPENAI_KEYWORDS_API_KEY
  if (!apiKey) {
    throw new Error('OPENAI_KEYWORDS_API_KEY manquante (env)')
  }
  return new OpenAI({ apiKey })
}

/**
 * Retourne les embeddings de la librairie autorisée (jamais null).
 * - Cache mémoire + cache disque (/tmp)
 * - Déduplication forte des mots-clé
 */
export async function getLibraryEmbeddings(
  model = 'text-embedding-3-small'
): Promise<{ items: { kw: string; vec: Vec }[]; model: string }> {
  // 1) Cache mémoire
  if (inMemory && inMemory.model === model) {
    // ✅ non-null garanti ici
    return { items: inMemory.items, model: inMemory.model }
  }

  // 2) Cache disque
  if (fs.existsSync(TMP_PATH)) {
    try {
      const raw = await fs.promises.readFile(TMP_PATH, 'utf8')
      const parsed = JSON.parse(raw) as { items?: { kw: string; vec: Vec }[]; model?: string }
      if (parsed?.items?.length && parsed.model === model) {
        inMemory = { items: parsed.items, model: parsed.model }
        return { items: inMemory.items, model: inMemory.model }
      }
    } catch {
      // ignore parse errors, we will recompute
    }
  }

  // 3) Recalcul si besoin
  const unique = Array.from(new Set(ALLOWED_KEYWORDS.map(normalizeKeyword))).filter(Boolean)
  const client = getClient()

  const BATCH = 512
  const items: { kw: string; vec: Vec }[] = []
  for (let i = 0; i < unique.length; i += BATCH) {
    const chunk = unique.slice(i, i + BATCH)
    const { data } = await client.embeddings.create({
      model,
      input: chunk,
    })
    data.forEach((d, idx) => {
      items.push({ kw: chunk[idx], vec: d.embedding as Vec })
    })
  }

  // 4) Alimente le cache mémoire + disque, puis retourne un objet concret
  inMemory = { items, model }
  try {
    await fs.promises.writeFile(TMP_PATH, JSON.stringify(inMemory), 'utf8')
  } catch {
    // best-effort
  }

  return { items, model } // ✅ jamais null
}

export function cosine(a: Vec, b: Vec): number {
  let dot = 0
  let na = 0
  let nb = 0
  const len = Math.min(a.length, b.length)
  for (let i = 0; i < len; i++) {
    dot += a[i] * b[i]
    na += a[i] * a[i]
    nb += b[i] * b[i]
  }
  return dot / (Math.sqrt(na) * Math.sqrt(nb) + 1e-9)
}
