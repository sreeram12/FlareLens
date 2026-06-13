/**
 * FlareLens Crohn's Stability Score Engine
 *
 * Computes a 0–100 deviation score from personal baseline.
 * Higher = worse (more deviation from stable baseline).
 *
 * Domain weights (from PRD):
 *   Gut Activity:    30%
 *   Energy/Sleep:    20%
 *   Nutrition:       15%
 *   Medications:     15%
 *   Exercise:        10%
 *   Clinical Labs:    5%
 *   Systemic:         5%
 */

export interface DomainScores {
  gut: number       // 0–30
  energy: number    // 0–20
  nutrition: number // 0–15
  medications: number // 0–15
  exercise: number  // 0–10
  clinical: number  // 0–5
  systemic: number  // 0–5
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
  medsAdherent: boolean
  stepsWalked: number
  exerciseMinutes: number
  crpLevel: number | null    // mg/L
  wbcLevel: number | null    // K/uL
  temperature: number | null // celsius
  nausea: number             // 0–10
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

  // ── GUT (30 pts) ────────────────────────────────────────────────────────────
  // BM count deviation (max ±5 from baseline)
  const bmDev = devScore(data.bowelMovements, baseline.bowel_movements_per_day, 5, 12)
  // Urgency
  const urgencyScore = (data.urgencyLevel / 10) * 8
  // Pain
  const painScore = (data.painScale / 10) * 8
  // Blood
  const bloodScore = data.bloodInStool ? 2 : 0

  const gut = clamp(bmDev + urgencyScore + painScore + bloodScore, 0, 30)

  if (data.bowelMovements > baseline.bowel_movements_per_day + 2) {
    reasons.push(`${data.bowelMovements} BMs today vs. baseline of ${baseline.bowel_movements_per_day}`)
  }
  if (data.bloodInStool) reasons.push('Blood detected in stool')
  if (data.urgencyLevel >= 6) reasons.push(`High urgency level (${data.urgencyLevel}/10)`)
  if (data.painScale >= 5) reasons.push(`Significant abdominal pain (${data.painScale}/10)`)

  // ── ENERGY/SLEEP (20 pts) ───────────────────────────────────────────────────
  const sleepDev = devScore(data.sleepHours, baseline.sleep_hours, 3, 8)
  const energyDev = devScore(data.energyLevel, baseline.energy_level, 5, 6)
  const fatigueScore = (data.fatigue / 10) * 6

  const energy = clamp(sleepDev + energyDev + fatigueScore, 0, 20)

  if (data.sleepHours < baseline.sleep_hours - 1.5) {
    reasons.push(`Poor sleep (${data.sleepHours.toFixed(1)}h vs. baseline ${baseline.sleep_hours}h)`)
  }
  if (data.fatigue >= 6) reasons.push(`High fatigue reported (${data.fatigue}/10)`)

  // ── NUTRITION (15 pts) ──────────────────────────────────────────────────────
  const calDev = devScore(data.caloriesConsumed, baseline.calories_per_day, 800, 10)
  const triggerScore = data.triggerFoodsConsumed ? 5 : 0

  const nutrition = clamp(calDev + triggerScore, 0, 15)

  if (data.triggerFoodsConsumed) reasons.push('Trigger foods consumed today')
  if (data.caloriesConsumed < baseline.calories_per_day * 0.6) {
    reasons.push(`Low caloric intake (${data.caloriesConsumed} kcal)`)
  }

  // ── MEDICATIONS (15 pts) ────────────────────────────────────────────────────
  const medications = data.medsAdherent ? 0 : 15

  if (!data.medsAdherent) reasons.push('Missed medication dose')

  // ── EXERCISE (10 pts) ───────────────────────────────────────────────────────
  const stepDev = devScore(data.stepsWalked, baseline.steps_per_day, baseline.steps_per_day, 10)
  const exercise = clamp(stepDev, 0, 10)

  if (data.stepsWalked < baseline.steps_per_day * 0.3 && baseline.steps_per_day > 0) {
    reasons.push(`Very low activity (${data.stepsWalked.toLocaleString()} steps)`)
  }

  // ── CLINICAL (5 pts) ────────────────────────────────────────────────────────
  let clinical = 0
  if (data.crpLevel !== null && data.crpLevel > baseline.crp_baseline * 2) {
    clinical = 5
    reasons.push(`Elevated CRP (${data.crpLevel} mg/L)`)
  } else if (data.crpLevel !== null && data.crpLevel > baseline.crp_baseline * 1.5) {
    clinical = 3
  }

  // ── SYSTEMIC (5 pts) ────────────────────────────────────────────────────────
  let systemic = 0
  if (data.temperature !== null && data.temperature > 38.0) {
    systemic = clamp((data.temperature - 37.0) * 2.5, 0, 5)
    reasons.push(`Low-grade fever (${data.temperature.toFixed(1)}°C)`)
  }
  const nauseaScore = (data.nausea / 10) * 3
  systemic = clamp(systemic + nauseaScore, 0, 5)

  const domainScores: DomainScores = {
    gut: Math.round(gut * 10) / 10,
    energy: Math.round(energy * 10) / 10,
    nutrition: Math.round(nutrition * 10) / 10,
    medications: Math.round(medications * 10) / 10,
    exercise: Math.round(exercise * 10) / 10,
    clinical: Math.round(clinical * 10) / 10,
    systemic: Math.round(systemic * 10) / 10,
  }

  const totalScore = Math.round(
    (gut + energy + nutrition + medications + exercise + clinical + systemic) * 10
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
    gut: { name: 'Gut Activity', maxScore: 30, icon: 'gut' },
    energy: { name: 'Energy & Sleep', maxScore: 20, icon: 'energy' },
    nutrition: { name: 'Nutrition', maxScore: 15, icon: 'nutrition' },
    medications: { name: 'Medications', maxScore: 15, icon: 'medications' },
    exercise: { name: 'Exercise', maxScore: 10, icon: 'exercise' },
    clinical: { name: 'Clinical', maxScore: 5, icon: 'clinical' },
    systemic: { name: 'Systemic', maxScore: 5, icon: 'systemic' },
  }
  return map[domain]
}
