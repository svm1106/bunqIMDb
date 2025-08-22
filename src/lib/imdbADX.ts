import { DataExchangeClient, SendApiAssetCommand } from "@aws-sdk/client-dataexchange";

const {
  AWS_REGION,
  IMDB_DATA_SET_ID,
  IMDB_REVISION_ID,
  IMDB_ASSET_ID,
  IMDB_API_KEY,
} = process.env;

if (!AWS_REGION || !IMDB_DATA_SET_ID || !IMDB_REVISION_ID || !IMDB_ASSET_ID || !IMDB_API_KEY) {
  throw new Error("Missing ADX/IMDb env vars");
}

const dx = new DataExchangeClient({ region: AWS_REGION });

export async function queryImdbGraphQL<T = any>(query: string, variables?: Record<string, any>): Promise<T> {
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
        "accept": "application/json",
      },
      Body: JSON.stringify({ query, variables }),
    })
  );

  const raw = (res as any).Body;
  const text = typeof raw === "string" ? raw : Buffer.from(raw as any).toString("utf8");
  const json = JSON.parse(text);
  if (json.errors) {
    const msg = (json.errors[0]?.message || "GraphQL error");
    const e: any = new Error(msg);
    e.errors = json.errors;
    throw e;
  }
  return json as T;
}
