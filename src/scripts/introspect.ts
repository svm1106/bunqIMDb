// src/scripts/introspect.ts
// Usage: npm run introspect
import { config as dotenv } from "dotenv";
dotenv({ path: ".env.local" });

import { DataExchangeClient, SendApiAssetCommand } from "@aws-sdk/client-dataexchange";

const {
  AWS_REGION, IMDB_DATA_SET_ID, IMDB_REVISION_ID, IMDB_ASSET_ID, IMDB_API_KEY,
} = process.env;

function assertEnv(name: string, val?: string) {
  if (!val || !val.trim()) { console.error(`Missing env: ${name}`); process.exit(1); }
}
assertEnv("AWS_REGION", AWS_REGION);
assertEnv("IMDB_DATA_SET_ID", IMDB_DATA_SET_ID);
assertEnv("IMDB_REVISION_ID", IMDB_REVISION_ID);
assertEnv("IMDB_ASSET_ID", IMDB_ASSET_ID);
assertEnv("IMDB_API_KEY", IMDB_API_KEY);

const dx = new DataExchangeClient({ region: AWS_REGION });

// Introspection ciblée: on récupère 'Title' + tous les types dont le nom contient "Episode" ou "Series"
const INTROSPECTION_QUERY = `
  query Introspect {
    __schema {
      types {
        name
        kind
        fields {
          name
          args { name type { kind name ofType { kind name } } }
          type { kind name ofType { kind name ofType { kind name } } }
        }
      }
    }
  }
`;

async function sendGql(query: string, variables?: any) {
  const res = await dx.send(new SendApiAssetCommand({
    DataSetId: IMDB_DATA_SET_ID!, RevisionId: IMDB_REVISION_ID!, AssetId: IMDB_ASSET_ID!,
    Method: "POST", Path: "/", RequestHeaders: {
      "x-api-key": IMDB_API_KEY!, "content-type": "application/json", "accept": "application/json",
    },
    Body: JSON.stringify({ query, variables }),
  }));
  const raw = (res as any).Body;
  const text = typeof raw === "string" ? raw : Buffer.from(raw as any).toString("utf8");
  const json = JSON.parse(text);
  if (json.errors) throw new Error(JSON.stringify(json.errors));
  return json.data;
}

function printType(t: any) {
  console.log(`\n## TYPE ${t.name} (${t.kind})`);
  for (const f of t.fields || []) {
    const argList = (f.args || []).map((a: any) => `${a.name}: ${a.type?.name || a.type?.ofType?.name || a.type?.kind}`).join(", ");
    const typeRepr = f.type?.name || f.type?.ofType?.name || f.type?.ofType?.ofType?.name || f.type?.kind;
    console.log(`- ${f.name}${argList ? `(${argList})` : ""}: ${typeRepr}`);
  }
}

(async () => {
  try {
    const data = await sendGql(INTROSPECTION_QUERY);

    const all = data.__schema.types as any[];
    // On garde uniquement des types "utiles"
    const interesting = all.filter(t =>
      t && t.name && !t.name.startsWith("__") &&
      (t.name === "Title" || /Episode/i.test(t.name) || /Series/i.test(t.name))
    );

    // Imprime d'abord Title
    const titleType = interesting.find(t => t.name === "Title");
    if (titleType) {
      console.log("===== TITLE TYPE =====");
      printType(titleType);
    } else {
      console.log("❌ Type 'Title' non trouvé dans le schéma (surprenant).");
    }

    // Puis les types qui contiennent Episode/Series
    console.log("\n===== TYPES LIÉS (Episode*/Series*) =====");
    for (const t of interesting.filter(t => t.name !== "Title")) {
      printType(t);
    }

    // Petit résumé des champs contenant 'episode' / 'series' détectés sur Title
    if (titleType?.fields) {
      const epFields = titleType.fields.filter((f: any) => /episode/i.test(f.name));
      const serFields = titleType.fields.filter((f: any) => /series/i.test(f.name));
      console.log("\n===== RÉCAP CHAMPS SUR 'Title' =====");
      console.log("Champs contenant 'episode':", epFields.map((f: any) => f.name));
      console.log("Champs contenant 'series':", serFields.map((f: any) => f.name));
    }
  } catch (e: any) {
    console.error("❌ Introspection error:", e.message || e);
    process.exit(1);
  }
})();
