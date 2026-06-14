'use server'

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
  getLabSummary,
} from '@/lib/actions'
import { computeFoodExerciseTrends, trendsSummaryLine } from '@/lib/trends'

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

export async function voiceGetDietGuidance() {
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
}

export async function voiceGetFlareFingerprint() {
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
}

export async function voiceGetSignals() {
  const items = await getFindings()
  return items.map((f) => ({ type: f.type, severity: f.severity, title: f.title, detail: f.detail }))
}

export async function voiceGetLabs() {
  const labs = await getLabSummary()
  if (labs.length === 0) {
    return { labs: [], note: 'No lab results imported yet — connect medical records on the Import page.' }
  }
  return {
    labs: labs.map((l) => ({
      name: l.label,
      latest: l.latest,
      unit: l.unit,
      status: l.status, // low | normal | high
      trend: l.trend, // up | down | flat | null
      prior: l.prior,
      concerning: l.concerning,
      lastMeasured: l.latestDate,
      note: l.note,
    })),
  }
}

export async function voiceGetFoodExerciseTrends(args: { days?: number | null }) {
  const days = args?.days ?? 14
  const all = await getRecentLogEntries(200)
  const cutoff = Date.now() - days * 86_400_000
  const inRange = all.filter((e) => new Date(e.loggedAt).getTime() >= cutoff)
  const t = computeFoodExerciseTrends(inRange)
  return { days, summary: trendsSummaryLine(t), ...t }
}
