/**
 * Lab intelligence — turns imported FHIR lab observations (entryType 'lab') into
 * IBD-aware summaries: latest value, trend vs. the prior result, reference status,
 * and a patient-safe note. Powers the doctor report's labs section + charts and
 * the lab-informed GI questions / diet guidance.
 *
 * Reference ranges are general adult anchors for discussion, NOT diagnosis.
 * Framework-free so the report (client) and actions/agents (server) can share it.
 */

export interface LabPoint {
  date: string
  value: number
}

export type LabStatus = 'low' | 'normal' | 'high'

export interface LabSummary {
  key: string
  label: string
  unit: string
  latest: number
  latestDate: string
  prior?: number
  trend: 'up' | 'down' | 'flat' | null
  /** True when the trend moved in the concerning direction (e.g. CRP up, ferritin down). */
  trendIsBad: boolean
  status: LabStatus
  /** True when the result is abnormal in the IBD-worrying direction. */
  concerning: boolean
  note: string
  series: LabPoint[]
}

interface Ref {
  label: string
  low?: number
  high?: number
  /** Which direction is the concerning one for IBD. */
  concern: 'high' | 'low'
  note: string
}

const REF: Record<string, Ref> = {
  crp: { label: 'CRP', high: 5, concern: 'high', note: 'C-reactive protein — an inflammation marker.' },
  calprotectin: { label: 'Fecal calprotectin', high: 50, concern: 'high', note: 'Reflects gut inflammation; >250 µg/g suggests active disease.' },
  ferritin: { label: 'Ferritin', low: 30, concern: 'low', note: 'Low ferritin means low iron stores (anemia risk in IBD).' },
  hemoglobin: { label: 'Hemoglobin', low: 13.5, concern: 'low', note: 'Low hemoglobin can signal anemia, common in IBD.' },
  wbc: { label: 'White cells (WBC)', low: 4, high: 11, concern: 'high', note: 'Elevated with inflammation or infection.' },
  albumin: { label: 'Albumin', low: 3.5, concern: 'low', note: 'Low albumin can accompany active inflammation.' },
  esr: { label: 'ESR', high: 20, concern: 'high', note: 'Sedimentation rate — an inflammation marker.' },
}

export function summarizeLabs(entries: { data: unknown }[]): LabSummary[] {
  const groups = new Map<string, { unit?: string; pts: LabPoint[] }>()
  for (const e of entries) {
    const d = (e.data ?? {}) as Record<string, unknown>
    const key = Object.keys(REF).find((k) => typeof d[k] === 'number')
    if (!key) continue
    const value = Number(d[key])
    const date = String(d.observed_at ?? '').slice(0, 10)
    if (!date || !Number.isFinite(value)) continue
    const g = groups.get(key) ?? { unit: undefined, pts: [] }
    if (!g.unit && typeof d.unit === 'string') g.unit = d.unit
    g.pts.push({ date, value })
    groups.set(key, g)
  }

  const out: LabSummary[] = []
  for (const [key, g] of groups) {
    const ref = REF[key]
    const series = g.pts.sort((a, b) => a.date.localeCompare(b.date))
    const latest = series[series.length - 1]
    const prior = series.length > 1 ? series[series.length - 2] : undefined
    const trend: LabSummary['trend'] = prior
      ? latest.value > prior.value * 1.05
        ? 'up'
        : latest.value < prior.value * 0.95
          ? 'down'
          : 'flat'
      : null
    let status: LabStatus = 'normal'
    if (ref.high != null && latest.value > ref.high) status = 'high'
    if (ref.low != null && latest.value < ref.low) status = 'low'
    const concerning =
      (ref.concern === 'high' && status === 'high') || (ref.concern === 'low' && status === 'low')
    const trendIsBad =
      (ref.concern === 'high' && trend === 'up') || (ref.concern === 'low' && trend === 'down')
    out.push({
      key,
      label: ref.label,
      unit: g.unit ?? '',
      latest: latest.value,
      latestDate: latest.date,
      prior: prior?.value,
      trend,
      trendIsBad,
      status,
      concerning,
      note: ref.note,
      series,
    })
  }
  // Concerning first, then alphabetical.
  return out.sort((a, b) => Number(b.concerning) - Number(a.concerning) || a.label.localeCompare(b.label))
}

/**
 * Per-entry flag for a single raw lab observation (used by the timeline to mark
 * abnormal results without recomputing the whole summary). Returns key=null for
 * labs outside the IBD reference panel (we have no range for those).
 */
export function flagLab(data: unknown): { key: string | null; status: LabStatus | null; concerning: boolean } {
  const d = (data ?? {}) as Record<string, unknown>
  const key = Object.keys(REF).find((k) => typeof d[k] === 'number')
  if (!key) return { key: null, status: null, concerning: false }
  const ref = REF[key]
  const value = Number(d[key])
  let status: LabStatus = 'normal'
  if (ref.high != null && value > ref.high) status = 'high'
  if (ref.low != null && value < ref.low) status = 'low'
  const concerning =
    (ref.concern === 'high' && status === 'high') || (ref.concern === 'low' && status === 'low')
  return { key, status, concerning }
}

/** One-line clinician-facing summary of the concerning labs (for AI guidance / questions). */
export function concerningLabsLine(labs: LabSummary[]): string {
  const c = labs.filter((l) => l.concerning)
  if (c.length === 0) return ''
  return c
    .map((l) => `${l.label} ${l.status === 'high' ? 'elevated' : 'low'} (${l.latest}${l.unit ? ' ' + l.unit : ''})`)
    .join(', ')
}
