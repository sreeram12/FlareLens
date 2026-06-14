/**
 * Builds specific, data-driven "questions for your GI" for the doctor report.
 * Questions reference the patient's actual recent labs (value + direction),
 * disease-activity trend, symptoms, and nutrition gaps — so they change as the
 * data updates, instead of reading like a generic checklist. Framework-free.
 */

import type { LabSummary } from './labs'

export interface GiQuestionInput {
  labs: LabSummary[]
  trend: 'improving' | 'stable' | 'worsening'
  period: number
  avgScore: number
  flareDays: number
  bloodDays: number
  maxPain: number
  avgBMPerDay: number
  avgSleep: number
  nutritionGaps: { label: string }[]
}

const fmt = (l: LabSummary) => `${l.latest}${l.unit ? ' ' + l.unit : ''}`
const since = (l: LabSummary) =>
  l.prior != null && l.trend === 'up'
    ? ` (up from ${l.prior})`
    : l.prior != null && l.trend === 'down'
      ? ` (down from ${l.prior})`
      : ''

// Per-lab, value-aware phrasing tied to the IBD concern direction.
const LAB_Q: Record<string, (l: LabSummary) => string> = {
  crp: (l) => `My CRP is ${fmt(l)}${since(l)} — does this level of inflammation warrant a change in treatment?`,
  calprotectin: (l) => `My fecal calprotectin is ${fmt(l)}${since(l)} (over 250 suggests active disease) — should we step up therapy or repeat a scope?`,
  ferritin: (l) => `My ferritin is ${fmt(l)} (low)${since(l)} — should I start iron, and could it be driving my fatigue?`,
  hemoglobin: (l) => `My hemoglobin is ${fmt(l)} (low)${since(l)} — am I becoming anemic, and do we need to treat it?`,
  albumin: (l) => `My albumin is ${fmt(l)} (low) — is inflammation affecting my protein levels or nutrition?`,
  wbc: (l) => `My white cell count is ${fmt(l)} (high) — could this be an infection rather than disease activity?`,
  esr: (l) => `My ESR is ${fmt(l)} (elevated)${since(l)} — does this confirm active inflammation?`,
}

export function buildGiQuestions(input: GiQuestionInput): string[] {
  const { labs, trend, period, avgScore, flareDays, bloodDays, maxPain, avgBMPerDay, avgSleep, nutritionGaps } = input
  const qs: string[] = []

  // Most urgent first.
  if (bloodDays > 0) {
    qs.push(`I've had blood in my stool on ${bloodDays} day${bloodDays > 1 ? 's' : ''} recently — should we do a colonoscopy or stool study?`)
  }

  // Specific concerning labs (already sorted concerning-first), each tied to its value.
  for (const l of labs.filter((l) => l.concerning).slice(0, 3)) {
    const q = LAB_Q[l.key]?.(l)
    if (q) qs.push(q)
  }

  // Disease-activity trajectory.
  if (trend === 'worsening') {
    qs.push(`My stability has trended worse over the last ${period} days — should we adjust my maintenance treatment?`)
  } else if (flareDays >= 3) {
    qs.push(`I've had ${flareDays} high-activity days this period — is my current therapy controlling things well enough?`)
  }

  if (avgScore >= 45) {
    qs.push(`My symptoms point to active disease — is my current medication or dose still the right one?`)
  }
  if (avgBMPerDay >= 5) {
    qs.push(`I'm averaging about ${Math.round(avgBMPerDay)} bowel movements a day — what's a realistic target, and when is it concerning?`)
  }
  if (maxPain >= 7) {
    qs.push(`My abdominal pain peaked at ${maxPain}/10 — what can I safely use for flare pain?`)
  }
  if (nutritionGaps.length > 0) {
    qs.push(`My tracking flags low ${nutritionGaps.slice(0, 3).map((g) => g.label).join(', ')} — should I supplement or get levels checked?`)
  }
  if (avgSleep > 0 && avgSleep < 5.5) {
    qs.push(`I'm averaging ${avgSleep.toFixed(1)}h of sleep — could poor sleep be feeding my symptoms, and what helps?`)
  }

  const unique = Array.from(new Set(qs))

  // Evergreen fallbacks only when the data didn't surface enough specifics.
  if (unique.length < 3) {
    unique.push('Are there specific dietary changes that could reduce my flare frequency?')
    if (unique.length < 3) unique.push('When should I contact the office between appointments?')
  }

  return unique.slice(0, 6)
}
