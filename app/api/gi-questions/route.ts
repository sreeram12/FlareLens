import { NextRequest, NextResponse } from 'next/server'

export const maxDuration = 30

/**
 * Generates tailored "questions for your GI" with Grok, fed the patient's recent
 * tracked data (labs, trend, symptoms, nutrition gaps, meds). The doctor report
 * falls back to a rule-based generator if this is unavailable, so it never blocks.
 */

const SYSTEM_PROMPT = `You help a person with Crohn's disease / IBD prepare for their gastroenterology appointment. Given their recent self-tracked data, write the most useful, SPECIFIC questions they should ask their GI.

Rules:
- Return 4 to 6 questions, ranked most important first.
- Be specific and reference their ACTUAL numbers/trends (e.g. "My CRP rose to 12.4 mg/L", "I've had 5 bowel movements a day"). Never invent data not provided.
- Write in the patient's first-person voice ("Should we…", "My … is …, what does that mean?").
- Prioritize what is abnormal or changing: concerning labs, worsening disease-activity trend, blood in stool, severe pain, frequent bowel movements, nutrient gaps, and whether current medication/dose is adequate.
- These are QUESTIONS to ask a doctor — do not answer them or give medical advice. No preamble, no numbering.

Respond with STRICT JSON only: { "questions": ["…", "…"] }`

export async function POST(req: NextRequest) {
  let ctx: unknown
  try {
    ctx = await req.json()
  } catch {
    return NextResponse.json({ questions: [] })
  }

  const apiKey = process.env.AI_GATEWAY_API_KEY
  if (!apiKey) return NextResponse.json({ questions: [] })

  try {
    const response = await fetch('https://api.x.ai/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: 'grok-3',
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          {
            role: 'user',
            content: `Here is my recent tracked data (JSON). Write my GI questions.\n\n${JSON.stringify(ctx, null, 2)}`,
          },
        ],
        temperature: 0.4,
        max_tokens: 600,
        response_format: { type: 'json_object' },
      }),
    })
    if (!response.ok) {
      console.error('[gi-questions] xAI error:', await response.text())
      return NextResponse.json({ questions: [] })
    }
    const result = await response.json()
    const content = result.choices?.[0]?.message?.content ?? ''
    const parsed = JSON.parse(content)
    const questions = Array.isArray(parsed.questions)
      ? parsed.questions.filter((q: unknown): q is string => typeof q === 'string' && q.trim().length > 0).slice(0, 6)
      : []
    return NextResponse.json({ questions })
  } catch (err) {
    console.error('[gi-questions] failure:', err)
    return NextResponse.json({ questions: [] })
  }
}
