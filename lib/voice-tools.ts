'use server'

import {
  saveLogEntry,
  getTodayScore,
  getRecentLogEntries,
  getLogEntriesForDate,
  getMedications,
  getScoreHistory,
  computeAndSaveTodayScore,
} from '@/lib/actions'

type EntryType =
  | 'bowel_movement'
  | 'symptom'
  | 'meal'
  | 'medication'
  | 'sleep'
  | 'exercise'

function compact(data: Record<string, unknown> | null | undefined) {
  const out: Record<string, unknown> = {}
  if (!data) return out
  for (const [k, v] of Object.entries(data)) {
    if (v !== null && v !== undefined) out[k] = v
  }
  return out
}

// Tool handlers invoked when the Grok voice agent issues a function call.
// Each returns a plain JSON-serializable object sent back as function_call_output.

export async function voiceLogHealthEntry(args: {
  entryType: EntryType
  summary: string
  data?: Record<string, unknown> | null
  rawTranscript?: string | null
}) {
  const { entryType, summary, data, rawTranscript } = args
  const cleaned = compact(data)
  await saveLogEntry(entryType, { ...cleaned, summary }, rawTranscript ?? summary, 'voice')
  await computeAndSaveTodayScore()
  return { ok: true, entryType, summary }
}

export async function voiceGetTodayStatus() {
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
    medications: meds.map((m) => ({
      name: m.medName,
      dose: m.dose,
      frequency: m.frequency,
    })),
  }
}

export async function voiceGetRecentActivity(args: { limit?: number | null }) {
  const entries = await getRecentLogEntries(args?.limit ?? 20)
  return entries.map((e) => ({
    type: e.entryType,
    data: e.data,
    source: e.source,
    loggedAt: e.loggedAt,
  }))
}

export async function voiceGetTrend(args: { days?: number | null }) {
  const history = await getScoreHistory(args?.days ?? 7)
  return history.map((h) => ({
    date: h.scoreDate,
    score: Number(h.totalScore),
    isFlareDay: h.isFlareDayBoolean,
  }))
}
