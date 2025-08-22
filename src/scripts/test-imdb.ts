// src/scripts/test-imdb.ts
// Usage :
//   npm run test:imdb              // test par défaut sur tt0111161
//   npm run test:imdb -- tt0105930 // autre imdbId

import { config as dotenv } from "dotenv";
dotenv({ path: ".env.local" });

import {
  DataExchangeClient,
  SendApiAssetCommand,
} from "@aws-sdk/client-dataexchange";

// ---- Env vars ----
const {
  AWS_REGION,
  AWS_ACCESS_KEY_ID,
  AWS_SECRET_ACCESS_KEY,
  IMDB_DATA_SET_ID,
  IMDB_REVISION_ID,
  IMDB_ASSET_ID,
  IMDB_API_KEY,
} = process.env;

function assertEnv(name: string, val?: string) {
  if (!val || String(val).trim() === "") {
    console.error(`❌ Variable d'environnement manquante: ${name}`);
    process.exit(1);
  }
}
assertEnv("AWS_REGION", AWS_REGION);
assertEnv("AWS_ACCESS_KEY_ID", AWS_ACCESS_KEY_ID);
assertEnv("AWS_SECRET_ACCESS_KEY", AWS_SECRET_ACCESS_KEY);
assertEnv("IMDB_DATA_SET_ID", IMDB_DATA_SET_ID);
assertEnv("IMDB_REVISION_ID", IMDB_REVISION_ID);
assertEnv("IMDB_ASSET_ID", IMDB_ASSET_ID);
assertEnv("IMDB_API_KEY", IMDB_API_KEY);

// ---- Param ----
const imdbId = process.argv[2] || "tt0111161";
if (!/^tt\d{7,}$/.test(imdbId)) {
  console.error("❌ imdbId invalide. Exemple: tt0111161");
  process.exit(1);
}

// ---- Client ADX ----
const dx = new DataExchangeClient({ region: AWS_REGION });

// ---- Query (conforme à TON schéma introspecté) ----
const QUERY = `
  query($id: ID!, $epFirst: Int = 50, $seasonLimit: Int = 1000) {
    title(id: $id) {
      id
      titleText { text }
      originalTitleText { text }
      titleType { id text }
      releaseYear { year }
      releaseDate { year month day }
      genres { genres { text } }
      spokenLanguages { spokenLanguages { text } }
      countriesOfOrigin { countries { text } }
      plots(first: 5) {
        edges {
          node {
            plotType
            plotText { plainText }
          }
        }
      }
      primaryImage { url }
      credits(filter: { categories: ["director"] }, first: 5) {
        edges { node { name { nameText { text } } } }
      }
      principalCredits(filter: { categories: ["cast"] }) {
        credits { name { nameText { text } } }
      }

      # 🔹 Si CE title est un épisode → saison/numéro ici :
      series {
        episodeNumber {
          seasonNumber
          episodeNumber
        }
        series { id }  # title de la série parente
      }

      # 🔹 Connexion épisodes pour les séries :
      episodes {
        # liste des saisons → sert à calculer seasonCount
        seasons(limit: $seasonLimit) {
          number
        }
        # échantillon d'épisodes pour contrôle
        episodes(first: $epFirst) {
          edges {
            node {
              id
              titleText { text }
              series {
                episodeNumber {
                  seasonNumber
                  episodeNumber
                }
                series { id }  # id de la série parente
              }
            }
          }
        }
      }
    }
  }
`;

// ---- Utils ----
type PlotEdge = { node?: { plotType?: string; plotText?: { plainText?: string } } };
const safeArr = <T,>(v: unknown): T[] => (Array.isArray(v) ? (v as T[]) : []);
function pickSynopsis(plots: PlotEdge[]) {
  const findType = (t: string) =>
    plots.find((p) => p?.node?.plotType === t)?.node?.plotText?.plainText;
  return findType("summary") || findType("outline") || plots[0]?.node?.plotText?.plainText || "";
}

async function sendApi(body: string) {
  const res = await dx.send(
    new SendApiAssetCommand({
      DataSetId: IMDB_DATA_SET_ID!,
      RevisionId: IMDB_REVISION_ID!,
      AssetId: IMDB_ASSET_ID!,
      Method: "POST",
      Path: "/",
      RequestHeaders: {
        "x-api-key": IMDB_API_KEY!,
        "content-type": "application/json",
        accept: "application/json",
      },
      Body: body,
    })
  );
  const rawBody: unknown = (res as any)?.Body;
  if (rawBody == null) throw new Error("ADX returned an empty body");
  const text = typeof rawBody === "string" ? rawBody : Buffer.from(rawBody as any).toString("utf8");
  const json = JSON.parse(text);
  if (json.errors) {
    throw Object.assign(new Error("GraphQL errors"), { errors: json.errors });
  }
  return json;
}

// ---- main ----
async function main() {
  const variables = { id: imdbId, epFirst: 50, seasonLimit: 1000 };
  const json = await sendApi(JSON.stringify({ query: QUERY, variables }));
  const t = json?.data?.title;
  if (!t) {
    console.error("❌ Pas de résultat pour cet imdbId.");
    process.exit(1);
  }

  // Champs core
  const originalTitle: string = t.originalTitleText?.text || t.titleText?.text || "";
  const originalLanguage: string = t.spokenLanguages?.spokenLanguages?.[0]?.text || "";
  const synopsis: string = pickSynopsis(safeArr<PlotEdge>(t.plots?.edges));
  const titleTypeId: string = t.titleType?.id || "";
  const category: string =
    titleTypeId && /^tv/i.test(titleTypeId)
      ? "tv"
      : titleTypeId === "movie"
      ? "movie"
      : t.titleType?.text || "";
  const mainGenre: string = t.genres?.genres?.[0]?.text || "";
  const linkToImdb: string = `https://www.imdb.com/title/${imdbId}`;
  const yearOfFirstBroadcast: number | string = t.releaseYear?.year || t.releaseDate?.year || "";
  const mainCountryOfProd: string = t.countriesOfOrigin?.countries?.[0]?.text || "";
  const mainDirectors: string[] = safeArr<any>(t.credits?.edges)
    .map((e) => e?.node?.name?.nameText?.text)
    .filter(Boolean);
  const mainActors: string[] = safeArr<any>(t.principalCredits?.[0]?.credits)
    .map((c) => c?.name?.nameText?.text)
    .filter(Boolean)
    .slice(0, 3);
  const keywords: string[] = safeArr<any>(t.genres?.genres)
    .map((g) => (g?.text || "").toLowerCase())
    .filter(Boolean);
  const posterUrl: string = t.primaryImage?.url || "";

  // 🔸 seasonCount exact via episodes.seasons(limit: ...)
  const seasonsArr = safeArr<any>(t?.episodes?.seasons);
  const seasonNumbers = seasonsArr
    .map((s) => (typeof s?.number === "number" ? s.number : null))
    .filter((n): n is number => n !== null);
  const seasonCount: number | null = seasonNumbers.length ? seasonNumbers.length : null;

  // 🔸 échantillon d’épisodes
  const episodeEdges = safeArr<any>(t?.episodes?.episodes?.edges);
  const episodesSample = episodeEdges.slice(0, 10).map((e) => {
    const node = e?.node || {};
    const en = node?.series?.episodeNumber || {};
    const seriesTitleId = node?.series?.series?.id || "";
    return {
      episodeId: node?.id || "",
      title: node?.titleText?.text || "",
      seasonNumber: typeof en?.seasonNumber === "number" ? en.seasonNumber : null,
      episodeNumber: typeof en?.episodeNumber === "number" ? en.episodeNumber : null,
      seriesTitleId,
    };
  });

  // 🔸 si le title courant est un épisode, on a sa saison/numéro ici :
  const selfSeasonNumber =
    t?.series?.episodeNumber?.seasonNumber ?? null;
  const selfEpisodeNumber =
    t?.series?.episodeNumber?.episodeNumber ?? null;
  const parentSeriesId = t?.series?.series?.id || "";

  const result = {
    imdbId,
    originalTitle,
    originalLanguage,
    synopsis,
    category,
    mainGenre,
    linkToImdb,
    yearOfFirstBroadcast,
    mainCountryOfProd,
    mainDirectors,
    mainActors,
    keywords,
    posterUrl,

    // ✅ Compte officiel des saisons (via Episodes.seasons)
    seasonCount,

    // Infos utiles de debug / contrôle
    episodesSample,
    // si l’ID demandé est un épisode
    selfSeasonNumber,
    selfEpisodeNumber,
    parentSeriesId,
  };

  console.log("✅ Champs extraits :");
  console.log(JSON.stringify(result, null, 2));
}

main().catch((e) => {
  const status = (e as any)?.$metadata?.httpStatusCode;
  if (status) console.error("HTTP status:", status);
  if ((e as any)?.errors) console.error("GraphQL errors:", JSON.stringify((e as any).errors, null, 2));
  console.error("❌ Erreur appel ADX→IMDb:", e.message || e);
  process.exit(1);
});
