// src/lib/keywords/generateKeywords.ts
import OpenAI from 'openai'
import crypto from 'crypto'

// Liste intégrée ici (pas de fichier séparé)
const PROMPT_LIBRARY = [
  'Kids','Family','Teens','Women','LGBT','Action','Adventure','Biopic',
  'Comedy','Crime','Charm','Game','Sport','Education','Drama','Fantasy',
  'Horror','Food','History','War','Western','Thriller','Nature','Music',
  'Science','Science-fi','Cinema','Art','Lifestyle','Business','Travel',
  'Tech','Romance','Societal','Suspense','Spy','Superhero','Military',
  'Space','Psychological','Paranormal','Animals','Culture','Cultural'
].map(s => s.trim()).filter(Boolean)

type Vec = number[]

function normalize(k: string): string {
  return k.normalize('NFKC').trim()
}
function normalizeCmp(k: string): string {
  return normalize(k).toLowerCase()
}
function uniqueCI(list: string[]): string[] {
  const seen = new Set<string>(), out: string[] = []
  for (const k of list) {
    const key = normalizeCmp(k)
    if (!key) continue
    if (!seen.has(key)) { seen.add(key); out.push(normalize(k)) }
  }
  return out
}

function getClient(): OpenAI {
  const apiKey = process.env.OPENAI_KEYWORDS_API_KEY
  if (!apiKey) throw new Error('OPENAI_KEYWORDS_API_KEY manquante (env)')
  return new OpenAI({ apiKey })
}

const CTX_EMB_CACHE = new Map<string, Vec>()
const LIB_EMB_CACHE = new Map<string, { kw: string; vec: Vec }[]>()

function cosine(a: Vec, b: Vec): number {
  let dot = 0, na = 0, nb = 0
  const L = Math.min(a.length, b.length)
  for (let i = 0; i < L; i++) {
    dot += a[i] * b[i]
    na  += a[i] * a[i]
    nb  += b[i] * b[i]
  }
  return dot / (Math.sqrt(na) * Math.sqrt(nb) + 1e-9)
}

async function embed(model: string, input: string | string[], client: OpenAI): Promise<Vec[] | Vec> {
  const arr = Array.isArray(input) ? input : [input]
  const { data } = await client.embeddings.create({ model, input: arr })
  const vecs = data.map(d => d.embedding as Vec)
  return Array.isArray(input) ? vecs : vecs[0]
}

async function getPromptLibEmbeddings(model: string, client: OpenAI) {
  if (LIB_EMB_CACHE.has(model)) return LIB_EMB_CACHE.get(model)!
  const uniq = uniqueCI(PROMPT_LIBRARY)
  const vecs = await embed(model, uniq, client) as Vec[]
  const items = uniq.map((kw, i) => ({ kw, vec: vecs[i] }))
  LIB_EMB_CACHE.set(model, items)
  return items
}

function buildPrompt(synopsis: string, genreOrCategoryLine: string) {
  return [
    'Tu travails pour une plateforme de broadcasting qui propose une multitude de',
    'programmes audiovisuels. Sur cette plateforme, un moteur de recherche par mots',
    'clés permet aux utilisateurs de trouver facilement un programme. Cela implique que',
    'chaque programme proposé sur la plateforme soit associé aux mots clés qui le',
    'caractérisent le mieux pour le grand public.',
    '',
    'Dans ce contexte, peux-tu me trouver 12 mots clés pour le programme audiovisuel',
    'défini ci-dessous :',
    `Sujet du programme : « ${synopsis} »`,
    `Genre du programme : « ${genreOrCategoryLine} »`,
    '',
    'Ces mots clés doivent être en anglais.',
    '4 mots clés sur 12 doivent provenir de la liste suivante : « Kids ; Family ; Teens ;',
    'Women ; LGBT ; Action ; Adventure ; Biopic ; Comedy ; Crime ; Charm ;',
    'Game ; Sport ; Education ; Drama ; Fantasy ; Horror ; Food ; History ; War ;',
    'Western ; Thriller ; Nature ; Music ; Science ; Science-fi ; Cinema ; Art ;',
    'Lifestyle ; Business ; Travel ; Tech ; Romance ; Societal ; Suspense ; Spy ;',
    'Superhero ; Military ; Space ; Psychological ; Paranormal ; Animals ;',
    'Culture ; Cultural ».',
    'Les mots clés restants doivent être connus du grand public et être les plus',
    'susceptibles d’être saisis dans le moteur de recherche pour faire apparaitre le',
    'programme défini ci-dessus.',
    '',
    'Présente-moi ces 12 mots clés, en ligne, séparés par une virgule. Ne renvoie que la liste.',
  ].join('\n')
}

function parseCsvKeywords(s: string): string[] {
  return s
    .split(/[,;]\s*/g)
    .map(x => x.replace(/^["'«\s]+|["'»\s]+$/g, ''))
    .map(normalize)
    .filter(Boolean)
}

export async function generateKeywordsForRow(params: {
  title?: string
  synopsis?: string
  directors?: string[]
  actors?: string[]
  existingGenres?: string[]   // genres IMDb ; prioritaires dans le flux enrich
  existingKeywords?: string[]
  targetCount?: number        // défaut 12
  keywordsOnlyMode?: boolean  // true = ne pas pré-insérer les genres IMDb
}): Promise<string[]> {
  const {
    title = '',
    synopsis = '',
    directors = [],
    actors = [],
    existingGenres = [],
    existingKeywords = [],
    targetCount = 12,
    keywordsOnlyMode = false,
  } = params

  const client = getClient()
  const embedModel = 'text-embedding-3-small'
  const chatModel  = process.env.OPENAI_KEYWORDS_CHAT_MODEL || 'gpt-4o-mini'

  // Contexte minimal si synopsis vide
  const synopsisLine =
    synopsis ||
    [title, directors.slice(0,2).join(', '), actors.slice(0,3).join(', ')]
      .filter(Boolean).join(' • ') || 'Unknown'

  const genreOrCategoryLine = (existingGenres && existingGenres.length > 0)
    ? existingGenres.join(', ')
    : 'Unknown'

  // 1) LLM (prompt COO)
  const prompt = buildPrompt(synopsisLine, genreOrCategoryLine)
  const res = await client.chat.completions.create({
    model: chatModel,
    messages: [{ role: 'user', content: prompt }],
    temperature: 0.4,
  })
  const raw = res.choices?.[0]?.message?.content || ''
  let llmList = uniqueCI(parseCsvKeywords(raw))

  // 2) S’assurer qu’au moins 4 viennent de la librairie (liste intégrée ici)
  const libSet = new Set(PROMPT_LIBRARY.map(normalizeCmp))
  let fromLib = llmList.filter(k => libSet.has(normalizeCmp(k)))

  if (fromLib.length < 4) {
    // compléter en choisissant les + pertinents via embeddings
    const ctxStr = [title, synopsis, existingGenres.join(', ')].filter(Boolean).join('\n') || 'empty'
    const ctxKey = crypto.createHash('sha1').update(ctxStr).digest('hex')
    let ctxVec: Vec
    if (CTX_EMB_CACHE.has(ctxKey)) ctxVec = CTX_EMB_CACHE.get(ctxKey)!
    else {
      ctxVec = await embed(embedModel, ctxStr, client) as Vec
      CTX_EMB_CACHE.set(ctxKey, ctxVec)
    }

    const lib = await getPromptLibEmbeddings(embedModel, client)
    const have = new Set(llmList.map(normalizeCmp))
    const candidates = lib
      .filter(it => !have.has(normalizeCmp(it.kw)))
      .map(it => ({ kw: it.kw, score: cosine(ctxVec, it.vec) }))
      .sort((a, b) => b.score - a.score)

    const need = 4 - fromLib.length
    const picked = candidates.slice(0, Math.max(0, need)).map(c => c.kw)
    llmList = uniqueCI(llmList.concat(picked))
    fromLib = llmList.filter(k => libSet.has(normalizeCmp(k)))
  }

  // 3) Fusion finale
  const imdbGenres = keywordsOnlyMode ? [] : (existingGenres || [])
  const prelude = uniqueCI(imdbGenres)

  const out: string[] = []
  const seen = new Set<string>()
  const push = (k: string) => {
    const key = normalizeCmp(k)
    if (!key) return
    if (!seen.has(key)) { seen.add(key); out.push(normalize(k)) }
  }

  // a) genres IMDb d’abord (si on est dans le flux enrich)
  for (const g of prelude) push(g)

  // b) puis les 12 du LLM (déjà ≥4 depuis la librairie)
  for (const k of llmList) push(k)

  // c) compléter si < targetCount en reprenant des candidats pertinents de la liste intégrée
  if (out.length < targetCount) {
    const ctxStr = [title, synopsis, imdbGenres.join(', '), llmList.join(', ')].filter(Boolean).join('\n') || 'empty'
    const ctxKey = crypto.createHash('sha1').update(ctxStr).digest('hex')
    let ctxVec: Vec
    if (CTX_EMB_CACHE.has(ctxKey)) ctxVec = CTX_EMB_CACHE.get(ctxKey)!
    else {
      ctxVec = await embed(embedModel, ctxStr, client) as Vec
      CTX_EMB_CACHE.set(ctxKey, ctxVec)
    }
    const lib = await getPromptLibEmbeddings(embedModel, client)
    const have = new Set(out.map(normalizeCmp))
    const candidates = lib
      .filter(it => !have.has(normalizeCmp(it.kw)))
      .map(it => ({ kw: it.kw, score: cosine(ctxVec, it.vec) }))
      .sort((a, b) => b.score - a.score)

    for (const c of candidates) {
      if (out.length >= targetCount) break
      push(c.kw)
    }
  }

  // d) remettre d’éventuels mots-clés existants en tête (priorité utilisateur)
  const existing = uniqueCI(existingKeywords)
  const merged = uniqueCI([...existing, ...out])

  return merged.slice(0, targetCount)
}
