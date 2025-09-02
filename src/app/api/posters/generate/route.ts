// src/app/api/posters/generate/route.ts
import { NextRequest } from 'next/server'
import OpenAI from 'openai'
import { buildPrompt } from '@/lib/prompt'

export const runtime = 'nodejs' // côté serveur

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! })

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const {
      id,
      title,
      synopsis,
      language,
      genre,
      year,
      keywords,
      nb_images = 1,
    } = body as {
      id?: string
      title: string
      synopsis?: string
      language?: string
      genre?: string
      year?: number | string
      keywords?: string
      nb_images?: number
    }

    const safeId = id || `row_${Date.now()}`
    const prompt = buildPrompt({
      titre: title,
      synopsis,
      langue: language,
      mots_cles: keywords,
      genre,
      date: year,
    })

    // ⚠️ mêmes paramètres que le script Python
    const res = await client.images.generate({
      model: 'gpt-image-1',
      prompt,
      n: nb_images,
      size: '1024x1536',
      quality: 'medium',   // active si dispo dans ta version du SDK
      background: 'auto',
    })

    const b64 = res.data?.[0]?.b64_json
    if (!b64) {
      return new Response(JSON.stringify({ error: 'No image returned' }), {
        status: 502, headers: { 'Content-Type': 'application/json' }
      })
    }

    const buffer = Buffer.from(b64, 'base64')
    const filename = `${safeId}_1.png`

    return new Response(buffer, {
      status: 200,
      headers: {
        'Content-Type': 'image/png',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'no-store',
      },
    })
  } catch (err: any) {
    const message =
      err?.response?.data?.error?.message || err?.message || 'Unexpected error'
    return new Response(JSON.stringify({ error: message }), {
      status: 400, headers: { 'Content-Type': 'application/json' }
    })
  }
}
