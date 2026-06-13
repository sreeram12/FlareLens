/**
 * Findings detection — the analyst agent's deterministic core.
 *
 * Turns the existing engines (flare fingerprint, nutrient gaps), plus labs and
 * medication adherence, into ranked, patient-safe "findings" the background
 * analyzer persists and surfaces (Signals feed + voice). The voice/chat agent
 * does the natural-language phrasing on top; these provide the substance and a
 * stable dedupe key so re-analysis upserts instead of duplicating.
 *
 * Framework-free (pure) so it is trivial to test and reuse.
 */

import type { FingerprintResult } from '@/lib/flare-fingerprint'
import type { NutritionAnalysis } from '@/lib/nutrition-analysis'

export type FindingSeverity = 'info' | 'watch' | 'alert'

export interface FindingCandidate {
  type: string
  severity: FindingSeverity
  title: string
  detail: string
  dedupeKey: string
  signals: Record<string, unknown>
}

export interface RecentLab {
  name: string
  value: number
  unit?: string
  observedAt?: string
  canonicalKey?: string
}

export interface FindingsInput {
  fingerprint: FingerprintResult
  nutrition: NutritionAnalysis
  medMissedDays: number
  recentLabs: RecentLab[]
}

/** Guidance for the chat + voice agents to proactively surface analyst findings. */
export const ANALYST_AI_GUIDANCE = `Proactive signals:
- At the very start of a conversation, call the signals tool once. If there is a new 'alert' or 'watch' finding, briefly surface the single most important one before anything else ("Before we start — I noticed your HRV's been low and appetite's down for a few days"). Keep it to one sentence and offer to go deeper.
- Don't dump every finding; lead with the top one. If everything is 'info' or there are none, don't bring it up unprompted.
- Findings are baseline deviations and context, never a diagnosis.`

const SEVERITY_RANK: Record<FindingSeverity, number> = { alert: 3, watch: 2, info: 1 }
export function severityRank(s: string): number {
  return SEVERITY_RANK[s as FindingSeverity] ?? 0
}

export function detectFindings(input: FindingsInput): FindingCandidate[] {
  const { fingerprint, nutrition, medMissedDays, recentLabs } = input
  const out: FindingCandidate[] = []

  // 1. Flare-fingerprint recognition.
  const t = fingerprint.today
  if (t.matchLevel === 'strong' || t.matchLevel === 'partial') {
    out.push({
      type: 'flare_fingerprint',
      severity: t.matchLevel === 'strong' ? 'alert' : 'watch',
      title:
        t.matchLevel === 'strong'
          ? 'Today resembles your flare fingerprint'
          : 'Some of your flare-fingerprint signals are active',
      detail: t.narrative,
      dedupeKey: 'flare_fingerprint',
      signals: {
        matchLevel: t.matchLevel,
        activeSignals: t.activeSignals.map((s) => s.label),
        bowelIsMainSignal: t.bowelIsMainSignal,
      },
    })
  } else if (t.matchLevel === 'watch' && t.activeSignals.length >= 2) {
    out.push({
      type: 'baseline_drift',
      severity: 'watch',
      title: 'A few signals are drifting above your baseline',
      detail: t.narrative,
      dedupeKey: 'baseline_drift',
      signals: { activeSignals: t.activeSignals.map((s) => s.label) },
    })
  }

  // 2. Lab shifts (inflammation markers).
  for (const lab of recentLabs) {
    const u = lab.unit ? ` ${lab.unit}` : ''
    if (lab.canonicalKey === 'crp' && lab.value > 5) {
      out.push({
        type: 'lab_shift',
        severity: lab.value > 10 ? 'alert' : 'watch',
        title: `CRP is elevated (${lab.value}${u})`,
        detail: `Your most recent C-reactive protein is ${lab.value}${u}, above the typical reference. CRP is an inflammation marker — worth discussing with your GI.`,
        dedupeKey: 'lab_shift:crp',
        signals: { value: lab.value, observedAt: lab.observedAt },
      })
    }
    if (lab.canonicalKey === 'calprotectin' && lab.value > 250) {
      out.push({
        type: 'lab_shift',
        severity: 'alert',
        title: `Fecal calprotectin is elevated (${lab.value}${u})`,
        detail: `Calprotectin of ${lab.value}${u} points to gut inflammation. Worth raising with your care team.`,
        dedupeKey: 'lab_shift:calprotectin',
        signals: { value: lab.value, observedAt: lab.observedAt },
      })
    }
  }

  // 3. Medication adherence.
  if (medMissedDays > 0) {
    out.push({
      type: 'med_adherence',
      severity: medMissedDays >= 2 ? 'watch' : 'info',
      title:
        medMissedDays >= 2
          ? `${medMissedDays} missed medication days recently`
          : 'A medication dose was missed',
      detail: `You logged ${medMissedDays} day${medMissedDays > 1 ? 's' : ''} with a missed or skipped dose in the last 2 weeks. Missed doses are useful context for your GI — and worth flagging if it keeps happening.`,
      dedupeKey: 'med_adherence',
      signals: { missedDays: medMissedDays },
    })
  }

  // 4. Nutrient gaps (top few from the IBD panel).
  for (const gap of nutrition.gaps.slice(0, 3)) {
    out.push({
      type: 'nutrient_gap',
      severity: 'info',
      title: `${gap.label} ${gap.status === 'low' ? 'running low' : 'running high'}`,
      detail: gap.note,
      dedupeKey: `nutrient_gap:${gap.key}`,
      signals: { avg: gap.avg, target: gap.target, status: gap.status },
    })
  }

  out.sort((a, b) => severityRank(b.severity) - severityRank(a.severity))
  return out
}
