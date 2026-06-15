/**
 * FlareLens Crohn's Stability Score Engine
 *
 * Computes a 0–100 deviation score from personal baseline.
 * Higher = worse (more deviation from stable baseline).
 *
 * Domain weights are grounded in IBD monitoring evidence, and deliberately lean
 * on objective / passively-captured signals (biomarkers + wearables) rather than
 * daily self-report — most people won't log pain/stools every day.
 *   Symptoms (PRO):     22%  — abdominal pain + stool frequency are the
 *                              clinical-remission targets in STRIDE-II.
 *   Inflammation:       20%  — CRP + fecal calprotectin, the treat-to-target
 *                              biomarkers (STRIDE-II short/intermediate targets).
 *   Recovery:           20%  — resting HR, HRV, sleep, respiratory rate; these
 *                              shift up to ~7 weeks before flares (Mount Sinai
 *                              IBD Forecast study, Gastroenterology 2025).
 *   Medications:        15%  — adherence underpins staying in remission.
 *   Nutrition (IBD-AID):13%  — anti-inflammatory eating pattern.
 *   Activity:           10%  — step counts fall during flares.
 *
 * Refs: STRIDE-II (Gastroenterology 2021); IBD Forecast Study (Gastroenterology 2025).
 */

export interface DomainScores {
  symptoms: number     // 0–22
  inflammation: number // 0–20
  recovery: number     // 0–20
  medications: number  // 0–15
  nutrition: number    // 0–13
  activity: number     // 0–10
}

export interface StabilityResult {
  totalScore: number
  domainScores: DomainScores
  scoreReasons: string[]
  isFlareDay: boolean
  trend: 'stable' | 'worsening' | 'improving'
}

export interface DayData {
  bowelMovements: number
  bloodInStool: boolean
  urgencyLevel: number       // 0–10
  painScale: number          // 0–10
  fatigue: number            // 0–10
  bloating: number           // 0–10
  sleepHours: number
  sleepQuality: number       // 0–10
  energyLevel: number        // 0–10
  caloriesConsumed: number
  triggerFoodsConsumed: boolean
  antiInflammatoryFoods: number // # of anti-inflammatory food entries today
  proInflammatoryFoods: number  // # of pro-inflammatory food entries today
  mealsLogged: number           // total meal/food entries today
  medsAdherent: boolean
  stepsWalked: number
  exerciseMinutes: number
  crpLevel: number | null    // mg/L
  wbcLevel: number | null    // K/uL
  calprotectin: number | null // µg/g (fecal)
  temperature: number | null // celsius
  nausea: number             // 0–10
  restingHeartRate: number | null // bpm (wearable)
  hrv: number | null              // ms (wearable)
  respiratoryRate: number | null  // breaths/min (wearable)
}

export interface Baseline {
  bowel_movements_per_day: number
  pain_scale: number
  sleep_hours: number
  energy_level: number
  stress_level: number
  calories_per_day: number
  steps_per_day: number
  weight_kg: number
  crp_baseline: number
  wbc_baseline: number
  calprotectin_baseline: number
  resting_hr_baseline: number
  hrv_baseline: number
  respiratory_rate_baseline: number
}

function clamp(val: number, min: number, max: number) {
  return Math.min(Math.max(val, min), max)
}

function devScore(actual: number, baseline: number, maxDev: number, weight: number): number {
  const deviation = Math.abs(actual - baseline)
  const ratio = clamp(deviation / maxDev, 0, 1)
  return ratio * weight
}

export function computeStabilityScore(data: DayData, baseline: Baseline): StabilityResult {
  const reasons: string[] = []

  // ── SYMPTOMS (22 pts) — STRIDE-II clinical-remission PROs ────────────────────
  // Abdominal pain + stool frequency are the patient-reported targets; we de-
  // emphasize raw BM count and fold in urgency/bloating/blood/nausea.
  const painScore = (data.painScale / 10) * 8
  const bmDev = devScore(data.bowelMovements, baseline.bowel_movements_per_day, 5, 5)
  const urgencyScore = (data.urgencyLevel / 10) * 4
  const bloatingScore = (data.bloating / 10) * 2
  const bloodScore = data.bloodInStool ? 2 : 0
  const symNausea = (data.nausea / 10) * 1
  const symptoms = clamp(painScore + bmDev + urgencyScore + bloatingScore + bloodScore + symNausea, 0, 22)

  if (data.painScale >= 5) reasons.push(`Significant abdominal pain (${data.painScale}/10)`)
  if (data.bloodInStool) reasons.push('Blood detected in stool')
  if (data.urgencyLevel >= 6) reasons.push(`High urgency level (${data.urgencyLevel}/10)`)
  if (data.bowelMovements > baseline.bowel_movements_per_day + 2) {
    reasons.push(`Stool frequency above baseline (${data.bowelMovements} vs. ${baseline.bowel_movements_per_day})`)
  }

  // ── INFLAMMATION (20 pts) — treat-to-target biomarkers ───────────────────────
  let inflammation = 0
  if (data.crpLevel !== null) {
    inflammation += clamp((data.crpLevel - baseline.crp_baseline) / (baseline.crp_baseline * 3), 0, 1) * 10
    if (data.crpLevel > baseline.crp_baseline * 2) reasons.push(`Elevated CRP (${data.crpLevel} mg/L)`)
  }
  if (data.calprotectin !== null) {
    inflammation += clamp((data.calprotectin - baseline.calprotectin_baseline) / 200, 0, 1) * 8
    if (data.calprotectin > 250) reasons.push(`High fecal calprotectin (${data.calprotectin} µg/g)`)
  }
  if (data.temperature !== null && data.temperature > 38.0) {
    inflammation += clamp((data.temperature - 37.0) * 2, 0, 2)
    reasons.push(`Low-grade fever (${data.temperature.toFixed(1)}°C)`)
  }
  inflammation = clamp(inflammation, 0, 20)

  // ── RECOVERY (20 pts) — wearable physiology + sleep (early flare signals) ─────
  let recovery = 0
  if (data.sleepHours < baseline.sleep_hours) {
    recovery += clamp((baseline.sleep_hours - data.sleepHours) / 3, 0, 1) * 6
  }
  if (data.restingHeartRate !== null && data.restingHeartRate > baseline.resting_hr_baseline) {
    recovery += clamp((data.restingHeartRate - baseline.resting_hr_baseline) / 12, 0, 1) * 5
  }
  if (data.hrv !== null && data.hrv < baseline.hrv_baseline) {
    recovery += clamp((baseline.hrv_baseline - data.hrv) / baseline.hrv_baseline, 0, 1) * 5
  }
  if (data.respiratoryRate !== null && data.respiratoryRate > baseline.respiratory_rate_baseline) {
    recovery += clamp((data.respiratoryRate - baseline.respiratory_rate_baseline) / 4, 0, 1) * 2
  }
  recovery += (data.fatigue / 10) * 4
  recovery = clamp(recovery, 0, 20)

  if (data.sleepHours < baseline.sleep_hours - 1.5) {
    reasons.push(`Poor sleep (${data.sleepHours.toFixed(1)}h vs. baseline ${baseline.sleep_hours}h)`)
  }
  if (data.restingHeartRate !== null && data.restingHeartRate > baseline.resting_hr_baseline + 6) {
    reasons.push(`Resting heart rate elevated (${data.restingHeartRate} bpm)`)
  }
  if (data.hrv !== null && data.hrv < baseline.hrv_baseline * 0.8) {
    reasons.push(`HRV below baseline (${data.hrv} ms)`)
  }
  if (data.fatigue >= 6) reasons.push(`High fatigue reported (${data.fatigue}/10)`)

  // ── NUTRITION / ANTI-INFLAMMATORY DIET (13 pts) ──────────────────────────────
  const calShortfall =
    data.caloriesConsumed < baseline.calories_per_day * 0.7 && data.caloriesConsumed > 0
      ? devScore(data.caloriesConsumed, baseline.calories_per_day, 900, 3)
      : 0
  const proLoad = clamp(data.proInflammatoryFoods * 3.5, 0, 8)
  const antiCredit = clamp(data.antiInflammatoryFoods * 1.5, 0, 5)
  const triggerScore = data.triggerFoodsConsumed ? 2 : 0
  const nutrition = clamp(proLoad + triggerScore + calShortfall - antiCredit, 0, 13)

  if (data.proInflammatoryFoods > 0) {
    reasons.push(
      `${data.proInflammatoryFoods} pro-inflammatory food${data.proInflammatoryFoods !== 1 ? 's' : ''} logged today`
    )
  }
  if (data.triggerFoodsConsumed) reasons.push('Known trigger foods consumed today')
  if (data.caloriesConsumed < baseline.calories_per_day * 0.6 && data.caloriesConsumed > 0) {
    reasons.push(`Low caloric intake (${data.caloriesConsumed} kcal)`)
  }

  // ── MEDICATIONS (15 pts) ─────────────────────────────────────────────────────
  const medications = data.medsAdherent ? 0 : 15
  if (!data.medsAdherent) reasons.push('Missed medication dose')

  // ── ACTIVITY (10 pts) — fewer steps tracks with flares ───────────────────────
  let activity = 0
  if (baseline.steps_per_day > 0 && data.stepsWalked < baseline.steps_per_day) {
    activity = clamp((baseline.steps_per_day - data.stepsWalked) / baseline.steps_per_day, 0, 1) * 10
  }
  if (data.stepsWalked < baseline.steps_per_day * 0.3 && baseline.steps_per_day > 0) {
    reasons.push(`Very low activity (${data.stepsWalked.toLocaleString()} steps)`)
  }

  const domainScores: DomainScores = {
    symptoms: Math.round(symptoms * 10) / 10,
    inflammation: Math.round(inflammation * 10) / 10,
    recovery: Math.round(recovery * 10) / 10,
    medications: Math.round(medications * 10) / 10,
    nutrition: Math.round(nutrition * 10) / 10,
    activity: Math.round(activity * 10) / 10,
  }

  const totalScore = Math.round(
    (symptoms + inflammation + recovery + medications + nutrition + activity) * 10
  ) / 10

  const isFlareDay = totalScore >= 45

  return {
    totalScore,
    domainScores,
    scoreReasons: reasons.slice(0, 5), // top 5 reasons
    isFlareDay,
    trend: 'stable', // computed externally from history
  }
}

export function getScoreLabel(score: number): {
  label: string
  color: string
  bgColor: string
  description: string
} {
  if (score < 20) return { label: 'Stable', color: 'text-emerald-400', bgColor: 'bg-emerald-500/10 border-emerald-500/20', description: 'Well within your normal range' }
  if (score < 40) return { label: 'Mild Deviation', color: 'text-yellow-400', bgColor: 'bg-yellow-500/10 border-yellow-500/20', description: 'Some deviation from your baseline' }
  if (score < 60) return { label: 'Moderate', color: 'text-orange-400', bgColor: 'bg-orange-500/10 border-orange-500/20', description: 'Notable deviation — monitor closely' }
  if (score < 80) return { label: 'High Activity', color: 'text-red-400', bgColor: 'bg-red-500/10 border-red-500/20', description: 'Significant deviation — consider contacting GI' }
  return { label: 'Flare', color: 'text-red-300', bgColor: 'bg-red-500/15 border-red-400/30', description: 'Major flare activity detected' }
}

export function getDomainLabel(domain: keyof DomainScores): {
  name: string
  maxScore: number
  icon: string
} {
  const map: Record<keyof DomainScores, { name: string; maxScore: number; icon: string }> = {
    symptoms: { name: 'Symptoms', maxScore: 22, icon: 'symptoms' },
    inflammation: { name: 'Inflammation', maxScore: 20, icon: 'inflammation' },
    recovery: { name: 'Recovery & Sleep', maxScore: 20, icon: 'recovery' },
    medications: { name: 'Medications', maxScore: 15, icon: 'medications' },
    nutrition: { name: 'Anti-Inflammatory Diet', maxScore: 13, icon: 'nutrition' },
    activity: { name: 'Activity', maxScore: 10, icon: 'activity' },
  }
  return map[domain]
}
