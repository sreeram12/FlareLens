'use server'

import { db } from '@/lib/db'
import { logEntries, dailyStabilityScores, flareSessions, patientBaselines, medications } from '@/lib/db/schema'
import { desc, eq, and, gte, lte, sql } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { computeStabilityScore, type Baseline, type DayData } from '@/lib/stability-score'
import { classifyFood, getPhaseForScore, getPhaseInfo } from '@/lib/ibd-aid'

const PATIENT_ID = 'alex'

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

  revalidatePath('/')
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
    const d = entry.data as Record<string, unknown>
    const desc = [d.description, d.food, d.name, entry.rawTranscript].filter(Boolean).join(' ')
    if (!desc) continue
    const cls = classifyFood(desc)
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
        water_ml: day.water !== undefined ? Math.round(day.water) : undefined,
        caffeine_mg: day.caffeine !== undefined ? Math.round(day.caffeine) : undefined,
        sodium_mg: day.sodium !== undefined ? Math.round(day.sodium) : undefined,
        sugars_g: day.sugars !== undefined ? Math.round(day.sugars) : undefined,
        expenditure: day.expenditure !== undefined ? Math.round(day.expenditure) : undefined,
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
  let steps = 6000
  let exerciseMins = 0
  let crp: number | null = null
  let wbc: number | null = null
  let temp: number | null = null
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
      if (d.trigger_foods) triggerFoods = true
      // Classify the food description for anti-inflammatory diet scoring.
      const desc = [d.description, d.food, d.name, entry.rawTranscript]
        .filter(Boolean)
        .join(' ')
      if (desc) {
        const cls = classifyFood(desc)
        if (cls === 'anti-inflammatory') antiInflammatoryFoods += 1
        else if (cls === 'pro-inflammatory') proInflammatoryFoods += 1
      }
      // Allow explicit classification from structured data
      if (typeof d.food_class === 'string') {
        if (d.food_class === 'anti-inflammatory') antiInflammatoryFoods += 1
        else if (d.food_class === 'pro-inflammatory') proInflammatoryFoods += 1
      }
    }

    if (entry.entryType === 'medication') {
      if (d.taken === false) medsAdherent = false
    }

    if (entry.entryType === 'exercise') {
      steps += Number(d.steps ?? 0)
      exerciseMins += Number(d.duration_minutes ?? 0)
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
    stepsWalked: steps,
    exerciseMinutes: exerciseMins,
    crpLevel: crp,
    wbcLevel: wbc,
    temperature: temp,
    nausea,
  }
}
