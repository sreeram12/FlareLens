import { NextRequest, NextResponse } from 'next/server'
import { EXTRACTION_FIELD_GUIDE } from '@/lib/health/log-schema'

export const runtime = 'nodejs'
export const maxDuration = 30

// Photo meal logging via Grok vision (grok-4.3 is multimodal; accepts jpg/png).
// Returns the SAME { entryType, summary, data } shape as /api/parse-log so the
// editable preview can correct it before saving.
const VISION_SYSTEM_PROMPT = `You are a nutrition vision assistant for a Crohn's / IBD health app. You are shown a PHOTO of a meal. Identify the foods and return structured JSON only — no markdown, no commentary.

The entry is always a meal, so set entryType to "meal".

${EXTRACTION_FIELD_GUIDE}

Photo-specific guidance:
- description: briefly list the foods you can see.
- portion: estimate from what's on the plate.
- calories: a rough estimate is acceptable here (the user can correct it).
- food_class and tags: classify using the IBD anti-inflammatory diet.

Return exactly this shape:
{ "entryType": "meal", "summary": "<short plain-English summary>", "data": { /* meal fields */ } }`

export async function POST(req: NextRequest) {
  try {
    const form = await req.formData()
    const image = form.get('image')
    if (!(image instanceof File)) {
      return NextResponse.json({ error: 'No image provided' }, { status: 400 })
    }

    const apiKey = process.env.AI_GATEWAY_API_KEY || process.env.XAI_API_KEY
    if (!apiKey) {
      return NextResponse.json({ error: 'No xAI API key configured' }, { status: 500 })
    }

    const buffer = Buffer.from(await image.arrayBuffer())
    const mime = image.type || 'image/jpeg'
    const dataUrl = `data:${mime};base64,${buffer.toString('base64')}`

    const response = await fetch('https://api.x.ai/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: 'grok-4.3',
        messages: [
          { role: 'system', content: VISION_SYSTEM_PROMPT },
          {
            role: 'user',
            content: [
              { type: 'text', text: 'Analyze this meal photo and return the JSON.' },
              { type: 'image_url', image_url: { url: dataUrl } },
            ],
          },
        ],
        temperature: 0.2,
        max_tokens: 600,
      }),
    })

    if (!response.ok) {
      console.error('[v0] vision-meal error:', response.status, await response.text())
      return NextResponse.json({ error: 'Could not analyze the photo.' }, { status: 502 })
    }

    const result = await response.json()
    const content: string = result.choices?.[0]?.message?.content ?? ''
    const parsed = safeParseJson(content)

    if (!parsed || typeof parsed !== 'object') {
      return NextResponse.json({ error: 'Could not read a meal from that photo.' }, { status: 422 })
    }

    // The entry is always a meal; guarantee the shape the preview expects.
    return NextResponse.json({
      entryType: 'meal',
      summary: typeof parsed.summary === 'string' ? parsed.summary : 'Meal from photo',
      data: (parsed.data && typeof parsed.data === 'object' ? parsed.data : {}) as Record<string, unknown>,
    })
  } catch (error) {
    console.error('[v0] vision-meal route error:', error)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}

/** Parse model output that may be wrapped in markdown fences or prose. */
function safeParseJson(content: string): { summary?: unknown; data?: unknown } | null {
  const cleaned = content.replace(/```json\s*|\s*```/g, '').trim()
  try {
    return JSON.parse(cleaned)
  } catch {
    const match = cleaned.match(/\{[\s\S]*\}/)
    if (match) {
      try {
        return JSON.parse(match[0])
      } catch {
        return null
      }
    }
    return null
  }
}
