// src/lib/enrichIMDB.ts
import { queryImdbGraphQL } from './imdbADX'
import { normalizeGenre, deduceCategory, normalizeCountry, normalizeLanguage } from './normalize'

export type EnrichmentResult = {
  enriched:
    | {
        title: string
        language: string
        genre: string
        category: string
        country: string
        keywords: string[]
        synopsis: string
        posterUrl: string
        imdbId?: string
        year?: string
        seasonCount?: number | null
        directors?: string[]
        actors?: string[]
        titleTypeText?: string
        titleTypeId?: string
      }
    | null
  error: string | null
  debug: string
}

const QUERY = `
  query($id: ID!, $epFirst: Int = 1, $seasonLimit: Int = 200) {
    title(id: $id) {
      id
      titleText { text }
      originalTitleText { text }
      titleType { id text }
      releaseYear { year }
      releaseDate { year month day }
      titleGenres { genres { genre { text } } }
      genres { genres { text } }
      spokenLanguages { spokenLanguages { text } }
      countriesOfOrigin { countries { text } }
      plots(first: 5) {
        edges { node { plotType plotText { plainText } } }
      }
      primaryImage { url }
      credits(filter: { categories: ["director"] }, first: 5) {
        edges { node { name { nameText { text } } } }
      }
      principalCredits(filter: { categories: ["cast"] }) {
        credits { name { nameText { text } } }
      }
      episodes {
        seasons(limit: $seasonLimit) { number }
        episodes(first: $epFirst) {
          edges {
            node {
              id
              series {
                episodeNumber { seasonNumber episodeNumber }
                series { id }
              }
            }
          }
        }
      }
    }
  }
`

const RETRIES = Number(process.env.IMDB_RETRIES || 4)
const TIMEOUT_MS = Number(process.env.IMDB_TIMEOUT_MS || 8000)

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
      await new Promise(r => setTimeout(r, delay))
    }
  }
  throw last
}

async function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  let to: any
  const killer = new Promise<never>((_, rej) => {
    to = setTimeout(() => rej(Object.assign(new Error('IMDb timeout'), { code: 504 })), ms)
  })
  try {
    return await Promise.race([p, killer])
  } finally {
    clearTimeout(to)
  }
}

type PlotEdge = { node?: { plotType?: string; plotText?: { plainText?: string } } }
const safeArr = <T,>(v: unknown): T[] => (Array.isArray(v) ? (v as T[]) : [])

function pickSynopsis(plots: PlotEdge[]): string {
  const byType = (t: string) => plots.find(p => p?.node?.plotType === t)?.node?.plotText?.plainText
  return byType('summary') || byType('outline') || plots?.[0]?.node?.plotText?.plainText || ''
}

export async function enrichIMDB(imdbId: string): Promise<EnrichmentResult> {
  if (!imdbId) return { enriched: null, error: 'No IMDb id', debug: '' }

  try {
    const json = await withRetry(
      () => withTimeout(queryImdbGraphQL<any>(QUERY, { id: imdbId, epFirst: 1, seasonLimit: 200 }), TIMEOUT_MS),
      RETRIES,
      400
    )

    const t = json?.data?.title
    if (!t) {
      return { enriched: null, error: '❌ IMDb : Pas de résultat', debug: QUERY }
    }

    // -------- Genres (deux sources possibles)
    const fromTitleGenres: string[] = Array.isArray(t.titleGenres?.genres)
      ? (t.titleGenres.genres
          .map((g: any) => g?.genre?.text)
          .filter((x: any): x is string => Boolean(x)) as string[])
      : []
    const fromGenres: string[] = Array.isArray(t.genres?.genres)
      ? (t.genres.genres
          .map((g: any) => g?.text)
          .filter((x: any): x is string => Boolean(x)) as string[])
      : []
    const rawGenres: string[] = fromTitleGenres.length ? fromTitleGenres : fromGenres
    const rawGenre: string = rawGenres[0] ?? ''
    const genreKeywords: string[] = rawGenres.map(g => String(g).toLowerCase())

    // -------- Langues (STRICT via normalizeLanguage) + Filipino/Tagalog fusion
    const rawLangs: string[] = Array.isArray(t.spokenLanguages?.spokenLanguages)
      ? t.spokenLanguages.spokenLanguages
          .map((l: any) => l?.text)
          .filter((x: any): x is string => Boolean(x))
      : []

    // règle d’entreprise : présence de Filipino ou Tagalog => libellé unique
    let language: string
    if (rawLangs.some(l => /filipino|tagalog/i.test(String(l)))) {
      language = 'Filipino, Tagalog'
    } else {
      const normLangs = rawLangs.map(normalizeLanguage).filter(x => x && x !== 'Unknown')
      language = normLangs[0] || 'Unknown'
    }

    // -------- Pays (STRICT)
    const countryRaw: string = t.countriesOfOrigin?.countries?.[0]?.text || 'Unknown'
    const country = normalizeCountry(countryRaw)

    // -------- Autres champs
    const synopsis: string = pickSynopsis(safeArr<PlotEdge>(t.plots?.edges))

    const directors: string[] = safeArr<any>(t.credits?.edges)
      .map(e => e?.node?.name?.nameText?.text)
      .filter((x: any): x is string => Boolean(x))

    const actors: string[] = safeArr<any>(t.principalCredits?.[0]?.credits)
      .map(c => c?.name?.nameText?.text)
      .filter((x: any): x is string => Boolean(x))
      .slice(0, 3)

    const seasonsArr: { number?: number }[] = Array.isArray(t?.episodes?.seasons) ? t.episodes.seasons : []
    const seasonCount: number | null =
      seasonsArr.length > 0 ? seasonsArr.filter(s => typeof s?.number === 'number').length : null

    const enriched = {
      title: (t.titleText?.text || t.originalTitleText?.text || '') as string,
      language,
      genre: normalizeGenre(rawGenre),
      category: deduceCategory('movie', rawGenre, t.titleType?.id || ''),
      country,
      keywords: Array.from(new Set(genreKeywords)) as string[],
      synopsis,
      posterUrl: (t.primaryImage?.url || '') as string,
      imdbId,
      year: String(t.releaseYear?.year || t.releaseDate?.year || ''),
      seasonCount,
      directors,
      actors,
      titleTypeText: (t.titleType?.text || '') as string,
      titleTypeId: (t.titleType?.id || '') as string,
    }

    return { enriched, error: null, debug: '✅ IMDb enrich OK' }
  } catch (e: any) {
    return { enriched: null, error: `❌ IMDb exception: ${e?.message || String(e)}`, debug: QUERY }
  }
}
