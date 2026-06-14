import { NextRequest, NextResponse } from 'next/server'
import { EXTRACTION_FIELD_GUIDE, ENTRY_TYPES } from '@/lib/health/log-schema'
import {
  getTodayScore,
  getRecentLogEntries,
  getDietGuidance,
  getFlareFingerprint,
  getFindings,
  getLabSummary,
} from '@/lib/actions'
import { concerningLabsLine } from '@/lib/labs'
import { computeFoodExerciseTrends, trendsSummaryLine } from '@/lib/trends'

export const maxDuration = 30

interface InMsg {
  role: 'user' | 'assistant'
  text: string
}

const SYSTEM_PROMPT = `You are FlareLens, a warm, attentive AI health companion for someone managing Crohn's disease / IBD. You are chatting in text. Keep replies natural, concise, and supportive — usually 1-3 short sentences. You are never a substitute for a doctor; if something sounds serious (heavy blood, severe pain, high fever), gently suggest contacting their GI.

You do two things:
1. LOG health events the user describes (bowel movements, symptoms, meals, medications, sleep, exercise) by producing a structured "draft". The user will review and save it, so it's OK if some fields are missing — fill what you can infer.
2. ANSWER questions about their health using the CONTEXT provided below (stability score, recent activity, diet phase, flare fingerprint, findings). Reference real numbers when relevant.

${EXTRACTION_FIELD_GUIDE}

Respond with STRICT JSON only (no markdown, no prose outside the JSON), exactly this shape:
{
  "reply": "<your short conversational reply to the user>",
  "draft": null OR {
    "entryType": "<one of: ${ENTRY_TYPES.join(', ')}>",
    "summary": "<1 sentence plain-English summary of the entry>",
    "data": { /* only the fields for that entryType, per the guide above */ }
  }
}

Rules:
- Set "draft" ONLY when the latest user message is logging a health event. For questions, greetings, or chit-chat, set "draft" to null.
- When you produce a draft, your "reply" should briefly say you've drafted it and invite them to review/save (e.g. "Got it — I've drafted your exercise log below. Tweak anything I missed and save it.").
- Never invent specific numbers the user didn't give (pain scores, durations, calories) — leave those fields out so they can fill them in.`

function buildContext(parts: string[]): string {
  return parts.filter(Boolean).join('\n')
}

export async function POST(req: NextRequest) {
  let messages: InMsg[] = []
  try {
    const body = await req.json()
    messages = Array.isArray(body.messages) ? body.messages : []
  } catch {
    return NextResponse.json({ reply: 'Sorry, I missed that — try again?', draft: null })
  }
  const lastUser = [...messages].reverse().find((m) => m.role === 'user')?.text ?? ''
  if (!lastUser.trim()) {
    return NextResponse.json({ reply: 'What would you like to log or ask?', draft: null })
  }

  const apiKey = process.env.AI_GATEWAY_API_KEY
  if (!apiKey) {
    return NextResponse.json({
      reply: "I can't reach the AI service right now — check the API key in project settings.",
      draft: null,
    })
  }

  // Gather a compact context so the assistant can answer questions with real data.
  let contextBlock = ''
  try {
    const [score, recent, diet, fp, findings, labs] = await Promise.all([
      getTodayScore().catch(() => null),
      getRecentLogEntries(200).catch(() => []),
      getDietGuidance().catch(() => null),
      getFlareFingerprint().catch(() => null),
      getFindings().catch(() => []),
      getLabSummary().catch(() => []),
    ])
    const recentLine = recent
      .slice(0, 8)
      .map((e) => `${e.entryType}(${new Date(e.loggedAt).toISOString().slice(0, 10)})`)
      .join(', ')
    // Food/exercise trends over the last 14 days.
    const cutoff = Date.now() - 14 * 86_400_000
    const trends = computeFoodExerciseTrends(recent.filter((e) => new Date(e.loggedAt).getTime() >= cutoff))
    // All labs (latest value + status + trend), with the concerning ones called out.
    const labsLine = labs.length
      ? labs
          .map((l) => `${l.label} ${l.latest}${l.unit ? ' ' + l.unit : ''} (${l.status}${l.trend ? `, ${l.trend}` : ''})`)
          .join('; ')
      : ''
    const concerning = concerningLabsLine(labs)
    contextBlock = buildContext([
      score ? `Stability score today: ${Number(score.totalScore)}/100${score.isFlareDayBoolean ? ' (flare day)' : ''}. Reasons: ${(score.scoreReasons as string[] | undefined)?.join('; ') || 'n/a'}.` : '',
      labsLine ? `Recent labs (from medical records): ${labsLine}.${concerning ? ` Concerning: ${concerning}.` : ''}` : '',
      `Food & exercise (last 14 days): ${trendsSummaryLine(trends)}`,
      diet ? `Diet phase: ${diet.phaseInfo.name}. Emphasize: ${diet.phaseInfo.emphasize?.slice(0, 4).join(', ')}. Today so far — anti-inflammatory: ${diet.todayAnti}, pro-inflammatory: ${diet.todayPro}.` : '',
      fp?.today ? `Flare fingerprint: ${fp.today.narrative}` : '',
      findings.length ? `Active findings: ${findings.map((f) => f.title).join('; ')}.` : '',
      recentLine ? `Recent entries: ${recentLine}.` : '',
    ])
  } catch {
    /* context is best-effort */
  }

  const today = new Date().toISOString().split('T')[0]
  const chatMessages = [
    { role: 'system', content: `${SYSTEM_PROMPT}\n\nToday's date is ${today}.\n\nCONTEXT (for answering questions):\n${contextBlock || '(no data yet)'}` },
    ...messages.slice(-8).map((m) => ({ role: m.role, content: m.text })),
  ]

  try {
    const response = await fetch('https://api.x.ai/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: 'grok-3',
        messages: chatMessages,
        temperature: 0.3,
        max_tokens: 600,
        response_format: { type: 'json_object' },
      }),
    })
    if (!response.ok) {
      console.error('[talk] xAI error:', await response.text())
      return NextResponse.json({ reply: 'I hit a snag reaching the assistant — try again in a moment.', draft: null })
    }
    const result = await response.json()
    const content = result.choices?.[0]?.message?.content ?? ''
    const parsed = JSON.parse(content)
    // Normalize/guard the shape.
    const reply = typeof parsed.reply === 'string' && parsed.reply.trim() ? parsed.reply : 'Done.'
    let draft = null
    if (parsed.draft && typeof parsed.draft === 'object' && ENTRY_TYPES.includes(parsed.draft.entryType)) {
      draft = {
        entryType: parsed.draft.entryType,
        summary: typeof parsed.draft.summary === 'string' ? parsed.draft.summary : reply,
        data: parsed.draft.data && typeof parsed.draft.data === 'object' ? parsed.draft.data : {},
      }
    }
    return NextResponse.json({ reply, draft })
  } catch (err) {
    console.error('[talk] failure:', err)
    return NextResponse.json({ reply: 'Sorry — I had trouble with that. Try rephrasing, or use the photo or voice options.', draft: null })
  }
}
