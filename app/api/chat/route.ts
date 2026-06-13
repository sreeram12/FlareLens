import { streamText, convertToModelMessages, tool, stepCountIs, type UIMessage } from 'ai'
import { createXai } from '@ai-sdk/xai'
import { z } from 'zod'
import {
  saveLogEntry,
  getTodayScore,
  getRecentLogEntries,
  getLogEntriesForDate,
  getMedications,
  getScoreHistory,
  computeAndSaveTodayScore,
  getDietGuidance,
  getFlareFingerprint,
  getFindings,
} from '@/lib/actions'
import { AID_AI_GUIDANCE, FOOD_CLASSES } from '@/lib/ibd-aid'
import { MEAL_TYPES, PORTIONS, INTENSITIES } from '@/lib/health/log-schema'
import { FLARE_AI_GUIDANCE } from '@/lib/flare-fingerprint'
import { ANALYST_AI_GUIDANCE } from '@/lib/findings'

const xai = createXai({ apiKey: process.env.AI_GATEWAY_API_KEY })

export const maxDuration = 30

/** zod enum from a readonly string list (loses literal typing — fine for tool I/O). */
const zEnum = (vals: readonly string[]) => z.enum(vals as unknown as [string, ...string[]])

const SYSTEM_PROMPT = `You are FlareLens, a warm, attentive AI health companion for someone managing Crohn's disease. Voice is the primary way the user talks to you, so keep replies natural, concise, and easy to listen to — usually 1-3 short sentences. Avoid markdown tables, bullet lists, and long paragraphs since responses may be read aloud.

Your job:
- LOG health events when the user describes them (bowel movements, symptoms, meals, medications, sleep, exercise). Use the logHealthEntry tool. After logging, briefly confirm what you recorded in plain language.
- ANSWER questions about their health using the data tools (getTodayStatus, getRecentActivity, getTrend). Be specific and reference real numbers.
- ENCOURAGE and reassure. You are supportive but never give definitive medical diagnoses. If something sounds serious (e.g. heavy blood, severe pain, high fever), gently suggest contacting their doctor.

When logging, infer the single most relevant entryType and fill the structured data fields you can. Don't ask for fields the user didn't mention — make reasonable inferences and note assumptions briefly. If the user reports multiple things in one message, call logHealthEntry multiple times. For meals, always set food_class (anti-inflammatory / neutral / pro-inflammatory) and any fitting IBD tags. For exercise, capture intensity and post-workout fatigue when mentioned.

${AID_AI_GUIDANCE}

${FLARE_AI_GUIDANCE}

${ANALYST_AI_GUIDANCE}

Today's date is ${new Date().toISOString().split('T')[0]}.`

const entryDataSchema = z
  .object({
    count: z.number().nullable().describe('Bowel movement count'),
    consistency: z.string().nullable().describe('formed | semi-formed | loose | watery'),
    blood: z.boolean().nullable().describe('Blood present in stool'),
    urgency: z.number().nullable().describe('Urgency 0-10'),
    pain_before: z.number().nullable().describe('Pain before BM 0-10'),
    pain_scale: z.number().nullable().describe('Symptom pain 0-10'),
    fatigue: z.number().nullable().describe('Fatigue 0-10'),
    bloating: z.number().nullable().describe('Bloating 0-10'),
    nausea: z.number().nullable().describe('Nausea 0-10'),
    notes: z.string().nullable().describe('Free-text notes'),
    // Meal (anti-inflammatory diet aware)
    description: z.string().nullable().describe('Meal description'),
    meal_type: zEnum(MEAL_TYPES).nullable().describe('breakfast | lunch | dinner | snack'),
    portion: zEnum(PORTIONS).nullable().describe('small | medium | large'),
    food_class: zEnum(FOOD_CLASSES).nullable().describe('IBD-AID class: anti-inflammatory | neutral | pro-inflammatory'),
    tags: z.array(z.string()).nullable().describe('IBD food tags (e.g. dairy, fried, fermented, high_fat)'),
    calories: z.number().nullable().describe('Estimated calories — only if clearly stated'),
    med_name: z.string().nullable().describe('Medication name'),
    dose: z.string().nullable().describe('Medication dose'),
    taken: z.boolean().nullable().describe('Whether the medication was taken'),
    duration_hours: z.number().nullable().describe('Sleep duration in hours'),
    quality: z.number().nullable().describe('Sleep quality 1-10'),
    // Exercise
    type: z.string().nullable().describe('Exercise type (walk, run, strength, etc.)'),
    focus: z.string().nullable().describe('Exercise focus (e.g. lower body, cardio)'),
    duration_minutes: z.number().nullable().describe('Exercise duration in minutes'),
    intensity: zEnum(INTENSITIES).nullable().describe('easy | moderate | hard'),
    rpe: z.number().nullable().describe('Rate of perceived exertion 0-10'),
    post_workout_fatigue: z.number().nullable().describe('Fatigue after exercise 0-10'),
    steps: z.number().nullable().describe('Steps walked'),
  })
  .describe('Structured fields for the entry. Only fill what is relevant; use null for the rest.')

function compact(data: Record<string, unknown>) {
  const out: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(data)) {
    if (v !== null && v !== undefined) out[k] = v
  }
  return out
}

export async function POST(req: Request) {
  const { messages }: { messages: UIMessage[] } = await req.json()

  const result = streamText({
    model: xai('grok-3'),
    system: SYSTEM_PROMPT,
    messages: await convertToModelMessages(messages),
    stopWhen: stepCountIs(6),
    tools: {
      logHealthEntry: tool({
        description:
          'Record a health event the user just described. Use for bowel movements, symptoms, meals, medications, sleep, or exercise.',
        inputSchema: z.object({
          entryType: z.enum([
            'bowel_movement',
            'symptom',
            'meal',
            'medication',
            'sleep',
            'exercise',
          ]),
          summary: z.string().describe('A short plain-English summary of what was logged'),
          data: entryDataSchema,
          rawTranscript: z.string().nullable().describe('The original user phrasing'),
        }),
        execute: async ({ entryType, summary, data, rawTranscript }) => {
          const cleaned = compact(data as Record<string, unknown>)
          await saveLogEntry(
            entryType,
            { ...cleaned, summary },
            rawTranscript ?? summary,
            'voice'
          )
          // Recompute today's stability score so the dashboard stays current
          await computeAndSaveTodayScore()
          return { ok: true, entryType, summary }
        },
      }),

      getTodayStatus: tool({
        description:
          "Get the user's current stability score for today, today's logged entries, and active medications.",
        inputSchema: z.object({}),
        execute: async () => {
          const [score, todayEntries, meds] = await Promise.all([
            getTodayScore(),
            getLogEntriesForDate(new Date().toISOString().split('T')[0]),
            getMedications(),
          ])
          return {
            stabilityScore: score ? Number(score.totalScore) : null,
            isFlareDay: score?.isFlareDayBoolean ?? false,
            scoreReasons: score?.scoreReasons ?? [],
            entriesToday: todayEntries.map((e) => ({
              type: e.entryType,
              data: e.data,
              loggedAt: e.loggedAt,
            })),
            medications: meds.map((m) => ({ name: m.medName, dose: m.dose, frequency: m.frequency })),
          }
        },
      }),

      getRecentActivity: tool({
        description: 'Get the most recent health log entries across all types.',
        inputSchema: z.object({
          limit: z.number().nullable().describe('How many entries to fetch (default 20)'),
        }),
        execute: async ({ limit }) => {
          const entries = await getRecentLogEntries(limit ?? 20)
          return entries.map((e) => ({
            type: e.entryType,
            data: e.data,
            source: e.source,
            loggedAt: e.loggedAt,
          }))
        },
      }),

      getTrend: tool({
        description:
          'Get the daily stability score history over the past N days to understand trends and spot flare days.',
        inputSchema: z.object({
          days: z.number().nullable().describe('Number of days of history (default 7)'),
        }),
        execute: async ({ days }) => {
          const history = await getScoreHistory(days ?? 7)
          return history.map((h) => ({
            date: h.scoreDate,
            score: Number(h.totalScore),
            isFlareDay: h.isFlareDayBoolean,
          }))
        },
      }),

      getDietGuidance: tool({
        description:
          "Get the user's current anti-inflammatory diet (IBD-AID) phase and today's food tally. Call this BEFORE giving any food or diet advice so suggestions match their current phase.",
        inputSchema: z.object({}),
        execute: async () => {
          const { phase, phaseInfo, todayAnti, todayPro } = await getDietGuidance()
          return {
            phase,
            phaseName: phaseInfo.name,
            appliesWhen: phaseInfo.appliesWhen,
            texture: phaseInfo.texture,
            emphasize: phaseInfo.emphasize,
            easeOff: phaseInfo.easeOff,
            exampleMeals: phaseInfo.exampleMeals,
            antiInflammatoryFoodsToday: todayAnti,
            proInflammatoryFoodsToday: todayPro,
          }
        },
      }),

      getFlareFingerprint: tool({
        description:
          "Compare today against the patient's learned flare fingerprint and list which signals are outside their personal baseline. Call this FIRST for 'why do I feel worse', 'what changed', or 'am I flaring' questions.",
        inputSchema: z.object({}),
        execute: async () => {
          const fp = await getFlareFingerprint()
          return {
            matchLevel: fp.today.matchLevel,
            narrative: fp.today.narrative,
            bowelIsMainSignal: fp.today.bowelIsMainSignal,
            activeSignals: fp.today.activeSignals.map((s) => ({
              signal: s.label,
              value: s.value,
              baseline: s.baseline,
              deviation: s.deviation,
            })),
            fingerprintLearning: fp.fingerprint.learning,
            fingerprintSummary: fp.fingerprint.summary,
            fingerprintSignals: fp.fingerprint.signals.map((s) => s.label),
          }
        },
      }),

      getSignals: tool({
        description:
          "Get the background analyst's current findings (flare-fingerprint matches, nutrient gaps, lab shifts, missed meds) for this patient, ranked by severity. Call at the start of a conversation to proactively surface anything important.",
        inputSchema: z.object({}),
        execute: async () => {
          const items = await getFindings()
          return items.map((f) => ({ type: f.type, severity: f.severity, title: f.title, detail: f.detail }))
        },
      }),
    },
  })

  return result.toUIMessageStreamResponse({
    onError: (error) => {
      console.error('[v0] Chat stream error:', error)
      const msg = error instanceof Error ? error.message : String(error)
      if (/auth|api key|unauthenticat/i.test(msg)) {
        return "I can't reach the AI service right now — the xAI API key looks invalid or missing. Please check the API key in project settings."
      }
      if (/rate.?limit|429|credits|quota/i.test(msg)) {
        return "The AI service is rate-limited or out of credits at the moment. Please try again shortly."
      }
      return 'Something went wrong reaching the assistant. Please try again in a moment.'
    },
  })
}
