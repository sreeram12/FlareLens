import { NextRequest, NextResponse } from 'next/server'

const SYSTEM_PROMPT = `You are a medical data extractor for a Crohn's disease health tracking app.
Given a natural language health log entry, extract structured data and return valid JSON only.

Determine the SINGLE most relevant entry type from: bowel_movement, symptom, meal, medication, sleep, exercise.

Return exactly this JSON shape (no markdown, no explanation, only JSON):
{
  "entryType": "<type>",
  "summary": "<1–2 sentence plain-English summary>",
  "data": {
    // For bowel_movement: count (int), consistency ("formed"|"semi-formed"|"loose"|"watery"), blood (bool), urgency (0-10), pain_before (0-10)
    // For symptom: pain_scale (0-10), fatigue (0-10), bloating (0-10), nausea (0-10), notes (string)
    // For meal: description (string), calories (int estimate), trigger_foods (bool), trigger_notes (string if trigger)
    // For medication: med_name (string), dose (string), taken (bool)
    // For sleep: duration_hours (float), quality (1-10)
    // For exercise: type (string), duration_minutes (int), steps (int)
  }
}`

export async function POST(req: NextRequest) {
  try {
    const { transcript } = await req.json()
    if (!transcript) {
      return NextResponse.json({ error: 'No transcript' }, { status: 400 })
    }

    const apiKey = process.env.AI_GATEWAY_API_KEY
    if (!apiKey) {
      // Fallback: return a basic parsed structure for demo
      return NextResponse.json(fallbackParse(transcript))
    }

    const response = await fetch('https://api.x.ai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'grok-3-mini',
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: transcript },
        ],
        temperature: 0.1,
        max_tokens: 400,
      }),
    })

    if (!response.ok) {
      console.error('[v0] xAI parse error:', await response.text())
      return NextResponse.json(fallbackParse(transcript))
    }

    const result = await response.json()
    const content = result.choices?.[0]?.message?.content ?? ''

    try {
      const parsed = JSON.parse(content)
      return NextResponse.json(parsed)
    } catch {
      console.error('[v0] Failed to parse xAI JSON response:', content)
      return NextResponse.json(fallbackParse(transcript))
    }
  } catch (error) {
    console.error('[v0] Parse-log route error:', error)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}

// Fallback parser when no AI key is available
function fallbackParse(transcript: string) {
  const lower = transcript.toLowerCase()

  if (lower.includes('bm') || lower.includes('bowel') || lower.includes('stool') || lower.includes('toilet')) {
    const countMatch = transcript.match(/(\d+)\s*(bm|bowel|times?|trips?)/i)
    return {
      entryType: 'bowel_movement',
      summary: `Bowel movement reported: "${transcript.slice(0, 80)}"`,
      data: {
        count: countMatch ? parseInt(countMatch[1]) : 1,
        consistency: lower.includes('water') ? 'watery' : lower.includes('loose') ? 'loose' : 'formed',
        blood: lower.includes('blood'),
        urgency: lower.includes('urgent') || lower.includes('rush') ? 6 : 2,
        pain_before: 0,
      },
    }
  }

  if (lower.includes('sleep') || lower.includes('slept') || lower.includes('rest')) {
    const hoursMatch = transcript.match(/(\d+\.?\d*)\s*h/i)
    return {
      entryType: 'sleep',
      summary: `Sleep logged: "${transcript.slice(0, 80)}"`,
      data: { duration_hours: hoursMatch ? parseFloat(hoursMatch[1]) : 7, quality: 7 },
    }
  }

  if (lower.includes('ate') || lower.includes('eat') || lower.includes('food') || lower.includes('meal')) {
    return {
      entryType: 'meal',
      summary: `Meal logged: "${transcript.slice(0, 80)}"`,
      data: { description: transcript.slice(0, 100), calories: 500, trigger_foods: false },
    }
  }

  if (lower.includes('walk') || lower.includes('run') || lower.includes('exercise') || lower.includes('gym')) {
    const minsMatch = transcript.match(/(\d+)\s*min/i)
    return {
      entryType: 'exercise',
      summary: `Exercise logged: "${transcript.slice(0, 80)}"`,
      data: { type: lower.includes('run') ? 'Run' : 'Walk', duration_minutes: minsMatch ? parseInt(minsMatch[1]) : 30, steps: 3000 },
    }
  }

  // Default to symptom
  const painMatch = transcript.match(/pain\s*(of|is|around|about|like|level)?\s*(?:a\s*)?(\d+)/i)
  const fatigueMatch = transcript.match(/tired|fatigue|exhausted/i)
  return {
    entryType: 'symptom',
    summary: `Symptom log: "${transcript.slice(0, 80)}"`,
    data: {
      pain_scale: painMatch ? parseInt(painMatch[2]) : 3,
      fatigue: fatigueMatch ? 5 : 2,
      bloating: lower.includes('bloat') ? 5 : 0,
      nausea: lower.includes('nausea') ? 4 : 0,
      notes: transcript.slice(0, 200),
    },
  }
}
