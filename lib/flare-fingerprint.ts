/**
 * Flare Fingerprint engine.
 *
 * The core novelty of FlareLens: instead of a generic flare *score*, it learns
 * each patient's personal early-warning *signature* — which signals drift away
 * from their baseline (and how early) in the days before a confirmed flare — and
 * recognizes when today's pattern resembles it.
 *
 * Crucially this is multi-domain and NOT bowel-frequency-centric: bowel movements
 * are just one of several tracked signals, and the engine explicitly reports
 * whether they are (or aren't) the main driver.
 *
 * Design notes:
 *  - Signal-agnostic: add an entry to TRACKED_SIGNALS (e.g. resting HR, HRV,
 *    appetite, joint pain) and the whole engine picks it up automatically.
 *  - Presence-aware: a day contributes a signal only if it was actually logged;
 *    we never invent baseline defaults (that would wash out real deviations).
 *  - Personal baselines: median + robust spread (MAD) over the patient's own
 *    stable days, so "normal" is relative to them, not a population threshold.
 *
 * Framework-free (no DB / server imports) so it is easy to unit-test.
 */

export type SignalDirection = 'higherWorse' | 'lowerWorse'
export type SignalDomain = 'gut' | 'recovery' | 'nutrition' | 'activity' | 'systemic'

export interface SignalDef {
  key: string
  label: string
  domain: SignalDomain
  direction: SignalDirection
}

/**
 * The signals the fingerprint tracks today. Extend this list (and extractDaySignals)
 * as more data comes online — e.g. resting HR / HRV from Apple Health, appetite,
 * joint pain, mouth ulcers — and the engine incorporates them with no other changes.
 */
export const TRACKED_SIGNALS: readonly SignalDef[] = [
  { key: 'fatigue', label: 'Fatigue', domain: 'recovery', direction: 'higherWorse' },
  { key: 'abdominalPain', label: 'Abdominal pain', domain: 'gut', direction: 'higherWorse' },
  { key: 'urgency', label: 'Urgency', domain: 'gut', direction: 'higherWorse' },
  { key: 'bloating', label: 'Bloating', domain: 'gut', direction: 'higherWorse' },
  { key: 'nausea', label: 'Nausea', domain: 'gut', direction: 'higherWorse' },
  { key: 'bowelMovements', label: 'Bowel movements', domain: 'gut', direction: 'higherWorse' },
  { key: 'sleepHours', label: 'Sleep', domain: 'recovery', direction: 'lowerWorse' },
  { key: 'restingHeartRate', label: 'Resting heart rate', domain: 'recovery', direction: 'higherWorse' },
  { key: 'hrv', label: 'HRV', domain: 'recovery', direction: 'lowerWorse' },
  { key: 'respiratoryRate', label: 'Respiratory rate', domain: 'recovery', direction: 'higherWorse' },
  { key: 'intakeCalories', label: 'Appetite (intake)', domain: 'nutrition', direction: 'lowerWorse' },
  { key: 'steps', label: 'Activity (steps)', domain: 'activity', direction: 'lowerWorse' },
]

/** Minimal log-entry shape the extractor needs (matches the DB rows). */
export interface RawEntry {
  entryType: string
  data: unknown
}

export interface DaySignals {
  date: string // YYYY-MM-DD
  signals: Record<string, number | null>
}

// ── Presence-aware per-day signal extraction ─────────────────────────────────

function num(v: unknown): number | undefined {
  const n = typeof v === 'number' ? v : typeof v === 'string' ? parseFloat(v) : NaN
  return Number.isFinite(n) ? n : undefined
}

/**
 * Turn one day's raw log entries into the tracked-signal vector. A signal is
 * `null` when nothing that day reported it (so it won't skew the baseline).
 */
export function extractDaySignals(entries: RawEntry[]): Record<string, number | null> {
  const fatigue: number[] = []
  const pain: number[] = []
  const urgency: number[] = []
  const bloating: number[] = []
  const nausea: number[] = []
  let bmCount = 0
  let hasBm = false
  let sleepHours: number | null = null
  let calories = 0
  let hasCalories = false
  let steps = 0
  let hasSteps = false
  let restingHeartRate: number | null = null
  let hrv: number | null = null
  let respiratoryRate: number | null = null

  for (const e of entries) {
    const d = (e.data ?? {}) as Record<string, unknown>
    switch (e.entryType) {
      case 'symptom': {
        const p = num(d.pain_scale); if (p !== undefined) pain.push(p)
        const f = num(d.fatigue); if (f !== undefined) fatigue.push(f)
        const b = num(d.bloating); if (b !== undefined) bloating.push(b)
        const n = num(d.nausea); if (n !== undefined) nausea.push(n)
        break
      }
      case 'bowel_movement': {
        hasBm = true
        bmCount += num(d.count) ?? 1
        const u = num(d.urgency); if (u !== undefined) urgency.push(u)
        const pb = num(d.pain_before); if (pb !== undefined) pain.push(pb)
        break
      }
      case 'sleep': {
        const h = num(d.duration_hours)
        if (h !== undefined) sleepHours = sleepHours === null ? h : Math.min(sleepHours, h)
        break
      }
      case 'meal': {
        const c = num(d.calories)
        if (c !== undefined && c > 0) { calories += c; hasCalories = true }
        break
      }
      case 'exercise':
      case 'weight': {
        const s = num(d.steps)
        if (s !== undefined) { steps += s; hasSteps = true }
        break
      }
      case 'wearable': {
        // Daily wearable record (Apple Health / Oura): recovery + activity signals.
        const sh = num(d.sleep_hours)
        if (sh !== undefined) sleepHours = sleepHours === null ? sh : Math.min(sleepHours, sh)
        const st = num(d.steps)
        if (st !== undefined) { steps += st; hasSteps = true }
        const rh = num(d.resting_hr)
        if (rh !== undefined) restingHeartRate = rh
        const hv = num(d.hrv)
        if (hv !== undefined) hrv = hv
        const rr = num(d.respiratory_rate)
        if (rr !== undefined) respiratoryRate = rr
        break
      }
    }
  }

  const maxOrNull = (arr: number[]) => (arr.length ? Math.max(...arr) : null)

  return {
    fatigue: maxOrNull(fatigue),
    abdominalPain: maxOrNull(pain),
    urgency: maxOrNull(urgency),
    bloating: maxOrNull(bloating),
    nausea: maxOrNull(nausea),
    bowelMovements: hasBm ? bmCount : null,
    sleepHours,
    restingHeartRate,
    hrv,
    respiratoryRate,
    intakeCalories: hasCalories ? calories : null,
    steps: hasSteps ? steps : null,
  }
}

// ── Stats helpers ────────────────────────────────────────────────────────────

function median(xs: number[]): number {
  const s = [...xs].sort((a, b) => a - b)
  const mid = Math.floor(s.length / 2)
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2
}

/** Robust spread: MAD scaled to ~std; falls back so we never divide by zero. */
function spread(xs: number[], med: number): number {
  if (xs.length < 2) return Math.max(Math.abs(med) * 0.15, 1)
  const mad = median(xs.map((x) => Math.abs(x - med))) * 1.4826
  if (mad > 1e-6) return mad
  const mean = xs.reduce((a, b) => a + b, 0) / xs.length
  const std = Math.sqrt(xs.reduce((a, b) => a + (b - mean) ** 2, 0) / xs.length)
  return Math.max(std, Math.abs(med) * 0.15, 1)
}

interface Baseline {
  median: number
  spread: number
}

// ── Public types ─────────────────────────────────────────────────────────────

export interface FingerprintSignal {
  key: string
  label: string
  domain: SignalDomain
  direction: SignalDirection
  /** Share of flares (0–1) where this signal deviated before onset. */
  frequency: number
  /** Average days of lead time before onset that it first deviated. */
  avgLeadDays: number
  /** Average peak deviation (in spreads) during the pre-flare window. */
  avgDeviation: number
}

export interface FlareFingerprint {
  flareCount: number
  /** True when there isn't enough flare history to form a stable fingerprint. */
  learning: boolean
  signals: FingerprintSignal[]
  /** Is bowel frequency one of the top-2 early signals? (Usually false — the point.) */
  bowelIsPrimary: boolean
  summary: string
}

export interface ActiveSignal {
  key: string
  label: string
  domain: SignalDomain
  direction: SignalDirection
  value: number
  baseline: number
  /** Deviation in spreads, in the "worse" direction (positive = worse). */
  deviation: number
}

export type MatchLevel = 'none' | 'watch' | 'partial' | 'strong'

export interface TodayMatch {
  matchLevel: MatchLevel
  activeSignals: ActiveSignal[]
  matchedFingerprintSignals: string[]
  bowelIsMainSignal: boolean
  narrative: string
}

export interface FingerprintResult {
  asOf: string
  fingerprint: FlareFingerprint
  today: TodayMatch
}

export interface BuildArgs {
  series: DaySignals[]
  flareOnsets: string[]
  today: string
  preWindowDays?: number
}

// ── Core ─────────────────────────────────────────────────────────────────────

const DEVIATION_Z = 1.0 // a signal "deviates" at ≥1 robust spread in the worse direction

function dayInWindow(date: string, onset: string, preDays: number): boolean {
  const d = Date.parse(date)
  const o = Date.parse(onset)
  const start = o - preDays * 86400000
  return d >= start && d < o
}

function leadDays(date: string, onset: string): number {
  return Math.round((Date.parse(onset) - Date.parse(date)) / 86400000)
}

/** Signed deviation in spreads, positive when in the "worse" direction. */
function worseDeviation(value: number, base: Baseline, dir: SignalDirection): number {
  const raw = value - base.median
  const worse = dir === 'higherWorse' ? raw : -raw
  return worse / base.spread
}

export function buildFlareFingerprint(args: BuildArgs): FingerprintResult {
  const { series, flareOnsets, today } = args
  const preWindowDays = args.preWindowDays ?? 7

  // Flare-affected dates (pre-window + a couple days after onset) are excluded
  // from baseline so "normal" reflects stable periods only.
  const excluded = new Set<string>()
  for (const onset of flareOnsets) {
    for (let i = -preWindowDays; i <= 2; i++) {
      excluded.add(new Date(Date.parse(onset) + i * 86400000).toISOString().split('T')[0])
    }
  }

  // Personal baselines per signal from stable days.
  const baselines: Record<string, Baseline> = {}
  for (const sig of TRACKED_SIGNALS) {
    const stable: number[] = []
    const all: number[] = []
    for (const day of series) {
      const v = day.signals[sig.key]
      if (v === null || v === undefined) continue
      all.push(v)
      if (!excluded.has(day.date)) stable.push(v)
    }
    const pool = stable.length >= 3 ? stable : all
    if (pool.length === 0) continue
    const med = median(pool)
    baselines[sig.key] = { median: med, spread: spread(pool, med) }
  }

  // Per-flare: which signals deviated in the pre-window, with lead time + peak.
  const perSignal = new Map<string, { flares: number; leads: number[]; peaks: number[] }>()
  for (const sig of TRACKED_SIGNALS) perSignal.set(sig.key, { flares: 0, leads: [], peaks: [] })

  for (const onset of flareOnsets) {
    const windowDays = series.filter((d) => dayInWindow(d.date, onset, preWindowDays))
    for (const sig of TRACKED_SIGNALS) {
      const base = baselines[sig.key]
      if (!base) continue
      let firstLead: number | null = null
      let peak = 0
      for (const day of windowDays) {
        const v = day.signals[sig.key]
        if (v === null || v === undefined) continue
        const dev = worseDeviation(v, base, sig.direction)
        if (dev >= DEVIATION_Z) {
          if (firstLead === null) firstLead = leadDays(day.date, onset)
          peak = Math.max(peak, dev)
        }
      }
      if (firstLead !== null) {
        const agg = perSignal.get(sig.key)!
        agg.flares += 1
        agg.leads.push(firstLead)
        agg.peaks.push(peak)
      }
    }
  }

  const flareCount = flareOnsets.length
  const signals: FingerprintSignal[] = []
  for (const sig of TRACKED_SIGNALS) {
    const agg = perSignal.get(sig.key)!
    if (agg.flares === 0) continue
    signals.push({
      key: sig.key,
      label: sig.label,
      domain: sig.domain,
      direction: sig.direction,
      frequency: flareCount ? agg.flares / flareCount : 0,
      avgLeadDays: agg.leads.reduce((a, b) => a + b, 0) / agg.leads.length,
      avgDeviation: agg.peaks.reduce((a, b) => a + b, 0) / agg.peaks.length,
    })
  }
  // Rank by how reliably + strongly a signal precedes flares.
  signals.sort((a, b) => b.frequency * (1 + b.avgDeviation) - a.frequency * (1 + a.avgDeviation))

  const top = signals.slice(0, 2).map((s) => s.key)
  const bowelIsPrimary = top.includes('bowelMovements')
  const learning = flareCount === 0 || signals.length === 0

  const fingerprint: FlareFingerprint = {
    flareCount,
    learning,
    signals,
    bowelIsPrimary,
    summary: summarizeFingerprint(signals, flareCount, bowelIsPrimary),
  }

  const todayMatch = evaluateToday(series, baselines, today, signals)
  return { asOf: today, fingerprint, today: todayMatch }
}

function summarizeFingerprint(signals: FingerprintSignal[], flareCount: number, bowelPrimary: boolean): string {
  if (flareCount === 0 || signals.length === 0) {
    return 'Still learning your flare fingerprint — log through a flare (or import history) and FlareLens will map which signals tend to shift first.'
  }
  const lead = signals.find((s) => s.avgLeadDays >= 1)
  const names = signals.slice(0, 4).map((s) => s.label.toLowerCase())
  const tail = bowelPrimary
    ? ''
    : ', while bowel-movement frequency is not the main early signal'
  const leadStr = lead ? ` Earliest signs appear about ${Math.round(lead.avgLeadDays)} day(s) before${tail ? '' : tail}.` : ''
  return `Across ${flareCount} flare${flareCount > 1 ? 's' : ''}, your earliest signals are ${listJoin(names)}${tail}.${leadStr}`
}

function evaluateToday(
  series: DaySignals[],
  baselines: Record<string, Baseline>,
  today: string,
  fingerprintSignals: FingerprintSignal[]
): TodayMatch {
  const todayDay =
    series.find((d) => d.date === today) ?? [...series].reverse().find((d) => d.date <= today)

  const active: ActiveSignal[] = []
  if (todayDay) {
    for (const sig of TRACKED_SIGNALS) {
      const base = baselines[sig.key]
      const v = todayDay.signals[sig.key]
      if (!base || v === null || v === undefined) continue
      const dev = worseDeviation(v, base, sig.direction)
      if (dev >= DEVIATION_Z) {
        active.push({
          key: sig.key,
          label: sig.label,
          domain: sig.domain,
          direction: sig.direction,
          value: v,
          baseline: Math.round(base.median * 10) / 10,
          deviation: Math.round(dev * 10) / 10,
        })
      }
    }
  }
  active.sort((a, b) => b.deviation - a.deviation)

  const fpKeys = new Set(fingerprintSignals.filter((s) => s.frequency >= 0.5).map((s) => s.key))
  const matched = active.filter((a) => fpKeys.has(a.key)).map((a) => a.key)

  // Match level blends "how much of your fingerprint is lit" with overall activity.
  let matchLevel: MatchLevel = 'none'
  if (fpKeys.size > 0) {
    const frac = matched.length / fpKeys.size
    if (frac >= 0.6 && matched.length >= 2) matchLevel = 'strong'
    else if (frac >= 0.3 || matched.length >= 1) matchLevel = 'partial'
    else if (active.length >= 2) matchLevel = 'watch'
  } else if (active.length >= 3) matchLevel = 'watch'
  else if (active.length >= 1) matchLevel = 'watch'

  const bowelActiveTop = active.length > 0 && active[0].key === 'bowelMovements'

  return {
    matchLevel,
    activeSignals: active,
    matchedFingerprintSignals: matched,
    bowelIsMainSignal: bowelActiveTop,
    narrative: todayNarrative(active, matched, matchLevel, fingerprintSignals, bowelActiveTop),
  }
}

function todayNarrative(
  active: ActiveSignal[],
  matched: string[],
  level: MatchLevel,
  fingerprintSignals: FingerprintSignal[],
  bowelTop: boolean
): string {
  if (active.length === 0) {
    return 'Your tracked signals are within your normal range today.'
  }
  const names = active.slice(0, 4).map((a) => a.label.toLowerCase())
  const bowelNote = bowelTop
    ? ''
    : active.some((a) => a.key === 'bowelMovements')
      ? ' Bowel-movement frequency is up a little, but it is not the biggest change.'
      : ' This is not a bowel-frequency pattern.'

  if (level === 'strong' && fingerprintSignals.length) {
    return `This closely resembles your prior flare fingerprint: ${listJoin(names)} are outside your baseline.${bowelNote} These are correlations, not proof — worth monitoring and noting for your care team.`
  }
  if (level === 'partial' && fingerprintSignals.length) {
    return `Some of your flare-fingerprint signals are active: ${listJoin(names)}.${bowelNote} Not a full match — worth watching.`
  }
  return `Outside your baseline today: ${listJoin(names)}.${bowelNote} These are context to monitor, not a diagnosis.`
}

function listJoin(items: string[]): string {
  if (items.length <= 1) return items[0] ?? ''
  if (items.length === 2) return `${items[0]} and ${items[1]}`
  return `${items.slice(0, -1).join(', ')}, and ${items[items.length - 1]}`
}

/**
 * Shared guidance for the chat + voice agents on Investigate / Flare conversations.
 * Tool-name-agnostic so both surfaces can reuse it.
 */
export const FLARE_AI_GUIDANCE = `Investigate & Flare conversations:
- When the user asks "why do I feel worse", "what changed", "what's going on", or says "I think I'm flaring", call the flare-fingerprint tool FIRST, then answer from what it returns.
- Lead with the signals that are actually outside their baseline, strongest first, with real numbers.
- If today's pattern matches their learned fingerprint, say so ("this resembles your prior flare fingerprint"). If the fingerprint is still being learned, say that honestly rather than inventing one.
- ALWAYS make clear whether bowel-movement frequency is or isn't the main signal — Crohn's is multi-domain, and that distinction is the core insight.
- These are correlations / baseline deviations, NOT causes or a diagnosis. Use "outside your baseline", "coincided with", "worth monitoring". For red flags (significant blood, severe pain, high fever, dehydration, persistent vomiting) recommend contacting their care team.
- For a suspected flare, keep it short and adaptive: ask only what you don't already know from the data, check red flags, then offer to generate a GI-ready summary.`

/** Derive flare onset dates from confirmed sessions + the start of each flare-day run. */
export function detectFlareOnsets(
  sessionDates: string[],
  flareDayDates: string[]
): string[] {
  const onsets = new Set<string>(sessionDates)
  const days = [...flareDayDates].sort()
  const flareSet = new Set(days)
  for (const d of days) {
    const prev = new Date(Date.parse(d) - 86400000).toISOString().split('T')[0]
    if (!flareSet.has(prev)) onsets.add(d) // start of a run
  }
  return [...onsets].sort()
}
