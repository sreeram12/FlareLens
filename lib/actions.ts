'use server'

import { db } from '@/lib/db'
import { logEntries, dailyStabilityScores, flareSessions, patientBaselines, medications, findings } from '@/lib/db/schema'
import { desc, eq, ne, and, gte, lte, sql } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { computeStabilityScore, type Baseline, type DayData } from '@/lib/stability-score'
import { classifyFood, getPhaseForScore, getPhaseInfo, IBD_FOOD_TAGS, FOOD_CLASSES, type FoodClass } from '@/lib/ibd-aid'
import { analyzeNutrition, type NutritionAnalysis } from '@/lib/nutrition-analysis'
import type { FastenRecords } from '@/lib/fasten-fhir'
import {
  buildFlareFingerprint,
  extractDaySignals,
  detectFlareOnsets,
  type FingerprintResult,
} from '@/lib/flare-fingerprint'
import { detectFindings, severityRank, type RecentLab } from '@/lib/findings'
import { summarizeLabs, type LabSummary } from '@/lib/labs'

const PATIENT_ID = 'alex'

// Pro-inflammatory tag ids — a meal carrying any of these counts as a "trigger".
const PRO_TAG_IDS = new Set(IBD_FOOD_TAGS.filter((t) => t.lean === 'pro-inflammatory').map((t) => t.id))

/**
 * Resolve a meal entry's inflammation class. An explicit `food_class` (set at
 * entry time and user-correctable) always wins; otherwise we classify the free
 * text. Used by both the diet-guidance summary and the score aggregator so a
 * meal is only ever counted once.
 */
function classifyMealEntry(entry: { data: unknown; rawTranscript?: string | null }): FoodClass {
  const d = (entry.data ?? {}) as Record<string, unknown>
  if (typeof d.food_class === 'string' && (FOOD_CLASSES as readonly string[]).includes(d.food_class)) {
    return d.food_class as FoodClass
  }
  const desc = [d.description, d.food, d.name, entry.rawTranscript].filter(Boolean).join(' ')
  return desc ? classifyFood(desc) : 'neutral'
}

// ─── Log Entries ─────────────────────────────────────────────────────────────

export async function getRecentLogEntries(limit = 50) {
  return db
    .select()
    .from(logEntries)
    .where(eq(logEntries.patientId, PATIENT_ID))
    .orderBy(desc(logEntries.loggedAt))
    .limit(limit)
}

export async function getLogEntriesForDate(dateStr: string) {
  const start = new Date(dateStr)
  start.setHours(0, 0, 0, 0)
  const end = new Date(dateStr)
  end.setHours(23, 59, 59, 999)

  return db
    .select()
    .from(logEntries)
    .where(
      and(
        eq(logEntries.patientId, PATIENT_ID),
        gte(logEntries.loggedAt, start),
        lte(logEntries.loggedAt, end)
      )
    )
    .orderBy(desc(logEntries.loggedAt))
}

export async function saveLogEntry(
  entryType: string,
  data: Record<string, unknown>,
  rawTranscript?: string,
  source: string = 'voice'
) {
  await db.insert(logEntries).values({
    patientId: PATIENT_ID,
    entryType,
    data,
    rawTranscript,
    source,
    loggedAt: new Date(),
  })
  revalidatePath('/')
  revalidatePath('/timeline')
}

// ─── Baselines ────────────────────────────────────────────────────────────────

export async function getBaselines(): Promise<Baseline> {
  const rows = await db
    .select()
    .from(patientBaselines)
    .where(eq(patientBaselines.patientId, PATIENT_ID))

  const map: Record<string, number> = {}
  for (const row of rows) {
    map[row.baselineKey] = parseFloat(row.baselineValue as string)
  }

  return {
    bowel_movements_per_day: map.bowel_movements_per_day ?? 2,
    pain_scale: map.pain_scale ?? 1,
    sleep_hours: map.sleep_hours ?? 7.5,
    energy_level: map.energy_level ?? 7,
    stress_level: map.stress_level ?? 3,
    calories_per_day: map.calories_per_day ?? 1900,
    steps_per_day: map.steps_per_day ?? 6000,
    weight_kg: map.weight_kg ?? 68,
    crp_baseline: map.crp_baseline ?? 2.5,
    wbc_baseline: map.wbc_baseline ?? 6.5,
  }
}

// ─── Stability Score ──────────────────────────────────────────────────────────

export async function computeAndSaveTodayScore() {
  const today = new Date().toISOString().split('T')[0]
  const entries = await getLogEntriesForDate(today)
  const baseline = await getBaselines()

  // Aggregate today's entries into DayData
  const dayData = aggregateEntriesIntoDayData(entries)
  const result = computeStabilityScore(dayData, baseline)

  await db
    .insert(dailyStabilityScores)
    .values({
      patientId: PATIENT_ID,
      scoreDate: today,
      totalScore: result.totalScore.toString(),
      domainScores: result.domainScores,
      scoreReasons: result.scoreReasons,
      isFlareDayBoolean: result.isFlareDay,
    })
    .onConflictDoUpdate({
      target: [dailyStabilityScores.patientId, dailyStabilityScores.scoreDate],
      set: {
        totalScore: result.totalScore.toString(),
        domainScores: result.domainScores,
        scoreReasons: result.scoreReasons,
        isFlareDayBoolean: result.isFlareDay,
      },
    })

  // NOTE: no revalidatePath here — getTodayScore() calls this during render when
  // a day has no stored score yet, and revalidate-during-render is unsupported.
  // Logging flows revalidate via saveLogEntry / runAnalysis instead.
  return result
}

export async function getTodayScore() {
  const today = new Date().toISOString().split('T')[0]

  // First try to get stored score
  const stored = await db
    .select()
    .from(dailyStabilityScores)
    .where(
      and(
        eq(dailyStabilityScores.patientId, PATIENT_ID),
        eq(dailyStabilityScores.scoreDate, today)
      )
    )
    .limit(1)

  if (stored.length > 0) return stored[0]

  // Compute on the fly
  await computeAndSaveTodayScore()

  const fresh = await db
    .select()
    .from(dailyStabilityScores)
    .where(
      and(
        eq(dailyStabilityScores.patientId, PATIENT_ID),
        eq(dailyStabilityScores.scoreDate, today)
      )
    )
    .limit(1)

  return fresh[0] ?? null
}

// ─── Diet / IBD-AID Guidance ────────────────────────────────────────────────

export async function getDietGuidance() {
  const score = await getTodayScore()
  const totalScore = score ? parseFloat(score.totalScore as string) : 0
  const phase = getPhaseForScore(totalScore)

  // Count today's anti-/pro-inflammatory meals for the at-a-glance summary
  const today = new Date().toISOString().split('T')[0]
  const entries = await getLogEntriesForDate(today)
  let anti = 0
  let pro = 0
  for (const entry of entries) {
    if (entry.entryType !== 'meal') continue
    const cls = classifyMealEntry(entry)
    if (cls === 'anti-inflammatory') anti++
    else if (cls === 'pro-inflammatory') pro++
  }

  return {
    totalScore,
    phase,
    phaseInfo: getPhaseInfo(phase),
    todayAnti: anti,
    todayPro: pro,
  }
}

/**
 * IBD nutrient-gap analysis over recent meal entries (uses the MacroFactor
 * micronutrient panel). Returns patient-safe findings for the Diet page and
 * doctor report. See lib/nutrition-analysis.
 */
export async function getNutrientGaps(days = 14): Promise<NutritionAnalysis> {
  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - days)

  const meals = await db
    .select()
    .from(logEntries)
    .where(
      and(
        eq(logEntries.patientId, PATIENT_ID),
        eq(logEntries.entryType, 'meal'),
        gte(logEntries.loggedAt, cutoff)
      )
    )

  return analyzeNutrition(meals, days)
}

// ─── Labs (from imported FHIR records) ─────────────────────────────────────────

/** Count of imported Fasten records — used to detect when a sync has landed. */
export async function getFastenRecordCount(): Promise<number> {
  const rows = await db
    .select({ id: logEntries.id })
    .from(logEntries)
    .where(and(eq(logEntries.patientId, PATIENT_ID), eq(logEntries.source, 'fasten')))
  return rows.length
}

/** IBD-aware summary of imported lab observations (latest, trend, status). */
export async function getLabSummary(): Promise<LabSummary[]> {
  const rows = await db
    .select()
    .from(logEntries)
    .where(and(eq(logEntries.patientId, PATIENT_ID), eq(logEntries.entryType, 'lab')))
    .orderBy(logEntries.loggedAt)
  return summarizeLabs(rows)
}

// ─── Flare Fingerprint ────────────────────────────────────────────────────────

/**
 * Build the patient's flare fingerprint from real history and evaluate today
 * against it. Powers the "what changed" / "am I flaring" voice moments and the
 * fingerprint card. See lib/flare-fingerprint.
 */
export async function getFlareFingerprint(historyDays = 90): Promise<FingerprintResult> {
  const since = new Date()
  since.setDate(since.getDate() - historyDays)
  const sinceDate = since.toISOString().split('T')[0]

  // 1. Log entries → per-day signal series.
  const entries = await db
    .select()
    .from(logEntries)
    .where(and(eq(logEntries.patientId, PATIENT_ID), gte(logEntries.loggedAt, since)))
    .orderBy(logEntries.loggedAt)

  const byDate = new Map<string, { entryType: string; data: unknown }[]>()
  for (const e of entries) {
    const date = new Date(e.loggedAt).toISOString().split('T')[0]
    const arr = byDate.get(date) ?? []
    arr.push({ entryType: e.entryType, data: e.data })
    byDate.set(date, arr)
  }
  const series = [...byDate.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([date, ents]) => ({ date, signals: extractDaySignals(ents) }))

  // 2. Flare onsets from confirmed sessions + flare-day run starts.
  const sessions = await db
    .select()
    .from(flareSessions)
    .where(and(eq(flareSessions.patientId, PATIENT_ID), gte(flareSessions.startedAt, since)))
  const sessionDates = sessions.map((s) => new Date(s.startedAt).toISOString().split('T')[0])

  const scoreRows = await db
    .select()
    .from(dailyStabilityScores)
    .where(and(eq(dailyStabilityScores.patientId, PATIENT_ID), gte(dailyStabilityScores.scoreDate, sinceDate)))
  const flareDayDates = scoreRows.filter((r) => r.isFlareDayBoolean).map((r) => r.scoreDate as string)

  const flareOnsets = detectFlareOnsets(sessionDates, flareDayDates)
  const today = new Date().toISOString().split('T')[0]

  return buildFlareFingerprint({ series, flareOnsets, today })
}

// ─── Background analyst (findings) ─────────────────────────────────────────────

// The findings table is created lazily (no drizzle-kit migrations are wired up).
let findingsTableEnsured = false
async function ensureFindingsTable() {
  if (findingsTableEnsured) return
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS findings (
      id serial PRIMARY KEY,
      patient_id text NOT NULL DEFAULT 'alex',
      type text NOT NULL,
      severity text NOT NULL DEFAULT 'info',
      title text NOT NULL,
      detail text NOT NULL,
      signals jsonb NOT NULL DEFAULT '{}',
      dedupe_key text NOT NULL,
      status text NOT NULL DEFAULT 'new',
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now(),
      CONSTRAINT findings_patient_dedupe_unique UNIQUE (patient_id, dedupe_key)
    )
  `)
  findingsTableEnsured = true
}

/**
 * Run the background analyst: gather the engines' output, detect findings, and
 * upsert them. Called by the cron route and on app open. Returns active findings.
 */
export async function runAnalysis() {
  await ensureFindingsTable()

  const [fingerprint, nutrition] = await Promise.all([getFlareFingerprint(), getNutrientGaps(14)])

  // Missed-medication days in the last 2 weeks.
  const medSince = new Date()
  medSince.setDate(medSince.getDate() - 14)
  const medEntries = await db
    .select()
    .from(logEntries)
    .where(and(eq(logEntries.patientId, PATIENT_ID), eq(logEntries.entryType, 'medication'), gte(logEntries.loggedAt, medSince)))
  const medMissedDays = new Set(
    medEntries
      .filter((e) => (e.data as Record<string, unknown>)?.taken === false)
      .map((e) => new Date(e.loggedAt).toISOString().split('T')[0])
  ).size

  // Most recent value per lab over the last 90 days.
  const labSince = new Date()
  labSince.setDate(labSince.getDate() - 90)
  const labEntries = await db
    .select()
    .from(logEntries)
    .where(and(eq(logEntries.patientId, PATIENT_ID), eq(logEntries.entryType, 'lab'), gte(logEntries.loggedAt, labSince)))
    .orderBy(desc(logEntries.loggedAt))
  const seenLab = new Set<string>()
  const recentLabs: RecentLab[] = []
  const CANONICAL = ['crp', 'calprotectin', 'ferritin', 'hemoglobin', 'wbc', 'albumin', 'esr']
  for (const e of labEntries) {
    const d = e.data as Record<string, unknown>
    const canonical = CANONICAL.find((k) => d[k] !== undefined)
    const value = canonical ? Number(d[canonical]) : Number(d.value)
    if (!Number.isFinite(value)) continue
    const key = canonical ?? String(d.lab_name ?? 'lab')
    if (seenLab.has(key)) continue
    seenLab.add(key)
    recentLabs.push({
      name: String(d.lab_name ?? 'Lab'),
      value,
      unit: d.unit as string | undefined,
      observedAt: d.observed_at as string | undefined,
      canonicalKey: canonical,
    })
  }

  const candidates = detectFindings({ fingerprint, nutrition, medMissedDays, recentLabs })

  for (const c of candidates) {
    await db
      .insert(findings)
      .values({
        patientId: PATIENT_ID,
        type: c.type,
        severity: c.severity,
        title: c.title,
        detail: c.detail,
        signals: c.signals,
        dedupeKey: c.dedupeKey,
      })
      .onConflictDoUpdate({
        target: [findings.patientId, findings.dedupeKey],
        set: {
          type: c.type,
          severity: c.severity,
          title: c.title,
          detail: c.detail,
          signals: c.signals,
          updatedAt: new Date(),
        },
      })
  }

  revalidatePath('/')
  return getFindings()
}

export async function getFindings() {
  await ensureFindingsTable()
  const rows = await db
    .select()
    .from(findings)
    .where(and(eq(findings.patientId, PATIENT_ID), ne(findings.status, 'dismissed')))
  return rows.sort(
    (a, b) =>
      severityRank(b.severity) - severityRank(a.severity) ||
      (b.updatedAt as Date).getTime() - (a.updatedAt as Date).getTime()
  )
}

export async function dismissFinding(id: number) {
  await ensureFindingsTable()
  await db
    .update(findings)
    .set({ status: 'dismissed', updatedAt: new Date() })
    .where(and(eq(findings.id, id), eq(findings.patientId, PATIENT_ID)))
  revalidatePath('/')
}

export async function getScoreHistory(days = 7) {
  // Ensure each of the past `days` days has a computed score so the
  // sparkline and trend have real data (not just today).
  await backfillScoreHistory(days)

  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - days)
  const cutoffDate = cutoff.toISOString().split('T')[0]

  return db
    .select()
    .from(dailyStabilityScores)
    .where(
      and(
        eq(dailyStabilityScores.patientId, PATIENT_ID),
        gte(dailyStabilityScores.scoreDate, cutoffDate)
      )
    )
    .orderBy(dailyStabilityScores.scoreDate)
}

// Compute and store a stability score for any of the past `days` days
// that have log entries but no saved score yet.
async function backfillScoreHistory(days = 7) {
  const baseline = await getBaselines()

  // Which dates already have a stored score?
  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - days)
  const cutoffDate = cutoff.toISOString().split('T')[0]

  const existing = await db
    .select({ scoreDate: dailyStabilityScores.scoreDate })
    .from(dailyStabilityScores)
    .where(
      and(
        eq(dailyStabilityScores.patientId, PATIENT_ID),
        gte(dailyStabilityScores.scoreDate, cutoffDate)
      )
    )
  const have = new Set(existing.map((r) => r.scoreDate))

  for (let i = 0; i <= days; i++) {
    const d = new Date()
    d.setDate(d.getDate() - i)
    const dateStr = d.toISOString().split('T')[0]
    if (have.has(dateStr)) continue

    const entries = await getLogEntriesForDate(dateStr)
    if (entries.length === 0) continue // no data that day — skip

    const dayData = aggregateEntriesIntoDayData(entries)
    const result = computeStabilityScore(dayData, baseline)

    await db
      .insert(dailyStabilityScores)
      .values({
        patientId: PATIENT_ID,
        scoreDate: dateStr,
        totalScore: result.totalScore.toString(),
        domainScores: result.domainScores,
        scoreReasons: result.scoreReasons,
        isFlareDayBoolean: result.isFlareDay,
      })
      .onConflictDoUpdate({
        target: [dailyStabilityScores.patientId, dailyStabilityScores.scoreDate],
        set: {
          totalScore: result.totalScore.toString(),
          domainScores: result.domainScores,
          scoreReasons: result.scoreReasons,
          isFlareDayBoolean: result.isFlareDay,
        },
      })
  }
}

// ─── Medications ──────────────────────────────────────────────────────────────

export async function getMedications() {
  return db
    .select()
    .from(medications)
    .where(and(eq(medications.patientId, PATIENT_ID), eq(medications.isActive, true)))
    .orderBy(medications.createdAt)
}

// ─── Flare Sessions ───────────────────────────────────────────────────────────

export async function startFlareSession(triggeredBy: 'user' | 'score', triggerScore?: number) {
  const result = await db
    .insert(flareSessions)
    .values({
      patientId: PATIENT_ID,
      triggeredBy,
      triggerScore: triggerScore?.toString(),
    })
    .returning()

  revalidatePath('/')
  return result[0]
}

export async function completeFlareSession(
  sessionId: number,
  responses: Record<string, unknown>
) {
  await db
    .update(flareSessions)
    .set({
      completedAt: new Date(),
      questionnaireResponses: responses,
      reportGenerated: true,
    })
    .where(eq(flareSessions.id, sessionId))

  revalidatePath('/')
}

// ─── MacroFactor Import ───────────────────────────────────────────────────────

import { normalizeWeight, type ParsedDay } from '@/lib/macrofactor-parser'

// Rounding helpers that preserve `undefined` (so absent metrics stay absent).
const round0 = (n?: number) => (n === undefined ? undefined : Math.round(n))
const round1 = (n?: number) => (n === undefined ? undefined : Math.round(n * 10) / 10)

export async function saveMacroFactorImport(days: ParsedDay[]) {
  let mealsInserted = 0
  let weightsInserted = 0
  let skipped = 0

  for (const day of days) {
    // Build a noon timestamp for the day so it lands on the right calendar date
    const loggedAt = new Date(`${day.date}T12:00:00`)

    // ── Nutrition → meal entry ──
    if (day.calories !== undefined) {
      const existing = await db
        .select({ id: logEntries.id })
        .from(logEntries)
        .where(
          and(
            eq(logEntries.patientId, PATIENT_ID),
            eq(logEntries.entryType, 'meal'),
            eq(logEntries.source, 'macrofactor'),
            sql`(${logEntries.data} ->> 'date') = ${day.date}`
          )
        )
        .limit(1)

      const mealData = {
        date: day.date,
        description: 'Daily nutrition (MacroFactor)',
        calories: Math.round(day.calories),
        protein_g: day.protein !== undefined ? Math.round(day.protein) : undefined,
        carbs_g: day.carbs !== undefined ? Math.round(day.carbs) : undefined,
        fat_g: day.fat !== undefined ? Math.round(day.fat) : undefined,
        fiber_g: day.fiber !== undefined ? Math.round(day.fiber) : undefined,
        water_ml: round0(day.water),
        caffeine_mg: round0(day.caffeine),
        sodium_mg: round0(day.sodium),
        sugars_g: round0(day.sugars),
        expenditure: round0(day.expenditure),
        // ── IBD micronutrient panel ──
        sat_fat_g: round1(day.satFat),
        trans_fat_g: round1(day.transFat),
        mono_fat_g: round1(day.monoFat),
        poly_fat_g: round1(day.polyFat),
        omega3_g: round1(day.omega3),
        omega6_g: round1(day.omega6),
        added_sugar_g: round1(day.addedSugar),
        cholesterol_mg: round0(day.cholesterol),
        alcohol_g: round1(day.alcohol),
        vitamin_d_mcg: round1(day.vitaminD),
        b12_mcg: round1(day.b12),
        calcium_mg: round0(day.calcium),
        iron_mg: round1(day.iron),
        folate_mcg: round0(day.folate),
        magnesium_mg: round0(day.magnesium),
        zinc_mg: round1(day.zinc),
        potassium_mg: round0(day.potassium),
        trigger_foods: false,
      }

      if (existing.length > 0) {
        await db.update(logEntries).set({ data: mealData, loggedAt }).where(eq(logEntries.id, existing[0].id))
        skipped++
      } else {
        await db.insert(logEntries).values({
          patientId: PATIENT_ID,
          entryType: 'meal',
          source: 'macrofactor',
          data: mealData,
          loggedAt,
        })
        mealsInserted++
      }
    }

    // ── Weight / activity → weight entry (also captures steps-only days) ──
    const weight = day.trendWeightKg ?? day.weightKg
    if (weight !== undefined || day.steps !== undefined || day.fatPercent !== undefined) {
      const existing = await db
        .select({ id: logEntries.id })
        .from(logEntries)
        .where(
          and(
            eq(logEntries.patientId, PATIENT_ID),
            eq(logEntries.entryType, 'weight'),
            eq(logEntries.source, 'macrofactor'),
            sql`(${logEntries.data} ->> 'date') = ${day.date}`
          )
        )
        .limit(1)

      const weightData = {
        date: day.date,
        weight_kg: weight !== undefined ? normalizeWeight(weight) : undefined,
        is_trend: day.trendWeightKg !== undefined,
        fat_percent: day.fatPercent,
        steps: day.steps !== undefined ? Math.round(day.steps) : undefined,
      }

      if (existing.length > 0) {
        await db.update(logEntries).set({ data: weightData, loggedAt }).where(eq(logEntries.id, existing[0].id))
      } else {
        await db.insert(logEntries).values({
          patientId: PATIENT_ID,
          entryType: 'weight',
          source: 'macrofactor',
          data: weightData,
          loggedAt,
        })
        weightsInserted++
      }
    }
  }

  revalidatePath('/')
  revalidatePath('/timeline')
  revalidatePath('/imports')

  return { mealsInserted, weightsInserted, updated: skipped, totalDays: days.length }
}

// ─── Fasten / FHIR medical-records import ──────────────────────────────────────

export async function saveFastenImport(records: FastenRecords) {
  let labsInserted = 0
  let clinicalInserted = 0
  let medsInserted = 0
  let skipped = 0

  // Labs → log entries (entryType 'lab'); canonical keys (crp/wbc/…) feed scoring.
  for (const lab of records.labs) {
    const observedAt = lab.observedAt ?? new Date().toISOString().split('T')[0]
    const loggedAt = new Date(`${observedAt}T12:00:00`)

    const existing = await db
      .select({ id: logEntries.id })
      .from(logEntries)
      .where(
        and(
          eq(logEntries.patientId, PATIENT_ID),
          eq(logEntries.entryType, 'lab'),
          eq(logEntries.source, 'fasten'),
          sql`(${logEntries.data} ->> 'lab_name') = ${lab.name}`,
          sql`(${logEntries.data} ->> 'observed_at') = ${observedAt}`
        )
      )
      .limit(1)
    if (existing.length > 0) { skipped++; continue }

    const data: Record<string, unknown> = {
      lab_name: lab.name,
      code: lab.code,
      value: lab.value,
      unit: lab.unit,
      observed_at: observedAt,
    }
    if (lab.canonicalKey) data[lab.canonicalKey] = lab.value

    await db.insert(logEntries).values({
      patientId: PATIENT_ID, entryType: 'lab', source: 'fasten', data, loggedAt,
    })
    labsInserted++
  }

  // Conditions / encounters / procedures → log entries (entryType 'clinical').
  for (const c of records.clinical) {
    const date = c.date ?? new Date().toISOString().split('T')[0]
    const loggedAt = new Date(`${date}T12:00:00`)

    const existing = await db
      .select({ id: logEntries.id })
      .from(logEntries)
      .where(
        and(
          eq(logEntries.patientId, PATIENT_ID),
          eq(logEntries.entryType, 'clinical'),
          eq(logEntries.source, 'fasten'),
          sql`(${logEntries.data} ->> 'text') = ${c.text}`,
          sql`(${logEntries.data} ->> 'date') = ${date}`
        )
      )
      .limit(1)
    if (existing.length > 0) { skipped++; continue }

    await db.insert(logEntries).values({
      patientId: PATIENT_ID,
      entryType: 'clinical',
      source: 'fasten',
      data: { kind: c.kind, text: c.text, date },
      loggedAt,
    })
    clinicalInserted++
  }

  // Medications → upsert into the medications table by name.
  for (const m of records.medications) {
    const existing = await db
      .select({ id: medications.id })
      .from(medications)
      .where(and(eq(medications.patientId, PATIENT_ID), eq(medications.medName, m.name)))
      .limit(1)
    if (existing.length > 0) { skipped++; continue }

    await db.insert(medications).values({
      patientId: PATIENT_ID,
      medName: m.name,
      dose: m.dose ?? '—',
      frequency: 'imported',
      isActive: m.status ? m.status === 'active' : true,
    })
    medsInserted++
  }

  revalidatePath('/')
  revalidatePath('/timeline')
  revalidatePath('/report')
  revalidatePath('/imports')

  return { labsInserted, clinicalInserted, medsInserted, skipped }
}

// ─── Helper ───────────────────────────────────────────────────────────────────

function aggregateEntriesIntoDayData(entries: Awaited<ReturnType<typeof getLogEntriesForDate>>): DayData {
  let bmCount = 0
  let bloodInStool = false
  let urgencyMax = 0
  let painMax = 0
  let fatigue = 0
  let bloating = 0
  let sleepHours = 7.5
  let sleepQuality = 7
  let energyLevel = 7
  let calories = 1900
  let triggerFoods = false
  let antiInflammatoryFoods = 0
  let proInflammatoryFoods = 0
  let mealsLogged = 0
  let medsAdherent = true
  let steps = 0
  let stepsLogged = false
  let exerciseMins = 0
  let crp: number | null = null
  let wbc: number | null = null
  const temp: number | null = null
  let nausea = 0

  for (const entry of entries) {
    const d = entry.data as Record<string, unknown>

    if (entry.entryType === 'bowel_movement') {
      bmCount += Number(d.count ?? 1)
      if (d.blood) bloodInStool = true
      urgencyMax = Math.max(urgencyMax, Number(d.urgency ?? 0))
      painMax = Math.max(painMax, Number(d.pain_before ?? 0))
    }

    if (entry.entryType === 'symptom') {
      painMax = Math.max(painMax, Number(d.pain_scale ?? 0))
      fatigue = Math.max(fatigue, Number(d.fatigue ?? 0))
      bloating = Math.max(bloating, Number(d.bloating ?? 0))
      nausea = Math.max(nausea, Number(d.nausea ?? 0))
    }

    if (entry.entryType === 'sleep') {
      sleepHours = Number(d.duration_hours ?? sleepHours)
      sleepQuality = Number(d.quality ?? sleepQuality)
      energyLevel = 10 - Math.round(fatigue)
    }

    if (entry.entryType === 'meal') {
      calories += Number(d.calories ?? 0)
      mealsLogged += 1
      // Single source of truth: explicit food_class wins, else classify text.
      const cls = classifyMealEntry(entry)
      if (cls === 'anti-inflammatory') antiInflammatoryFoods += 1
      else if (cls === 'pro-inflammatory') proInflammatoryFoods += 1
      // A meal is a "trigger" if it's pro-inflammatory, carries a pro-leaning
      // IBD tag, or was explicitly flagged (legacy field).
      const tags = Array.isArray(d.tags) ? d.tags.map(String) : []
      if (cls === 'pro-inflammatory' || d.trigger_foods || tags.some((t) => PRO_TAG_IDS.has(t))) {
        triggerFoods = true
      }
    }

    if (entry.entryType === 'medication') {
      if (d.taken === false) medsAdherent = false
    }

    if (entry.entryType === 'exercise') {
      exerciseMins += Number(d.duration_minutes ?? 0)
      if (d.steps != null) {
        steps += Number(d.steps)
        stepsLogged = true
      }
    }

    // MacroFactor / wearable imports store daily steps on the weight entry.
    if (entry.entryType === 'weight') {
      if (d.steps != null) {
        steps += Number(d.steps)
        stepsLogged = true
      }
    }

    // Daily wearable record (Apple Health / Oura): real sleep + steps.
    if (entry.entryType === 'wearable') {
      if (d.sleep_hours != null) sleepHours = Number(d.sleep_hours)
      if (d.steps != null) {
        steps += Number(d.steps)
        stepsLogged = true
      }
    }

    if (entry.entryType === 'lab') {
      if (d.crp !== undefined) crp = Number(d.crp)
      if (d.wbc !== undefined) wbc = Number(d.wbc)
    }
  }

  // If meals were logged, reset calories to sum (otherwise keep baseline estimate)
  const mealEntries = entries.filter(e => e.entryType === 'meal')
  if (mealEntries.length > 0) {
    calories = mealEntries.reduce((sum, e) => {
      const d = e.data as Record<string, unknown>
      return sum + Number(d.calories ?? 0)
    }, 0)
  }

  return {
    bowelMovements: bmCount || 0,
    bloodInStool,
    urgencyLevel: urgencyMax,
    painScale: painMax,
    fatigue,
    bloating,
    sleepHours,
    sleepQuality,
    energyLevel,
    caloriesConsumed: calories,
    triggerFoodsConsumed: triggerFoods,
    antiInflammatoryFoods,
    proInflammatoryFoods,
    mealsLogged,
    medsAdherent,
    stepsWalked: stepsLogged ? steps : 6000,
    exerciseMinutes: exerciseMins,
    crpLevel: crp,
    wbcLevel: wbc,
    temperature: temp,
    nausea,
  }
}
