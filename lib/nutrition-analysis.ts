/**
 * IBD nutrient-gap analysis.
 *
 * Turns imported MacroFactor nutrition (the micronutrient panel stored on
 * source='macrofactor' meal entries) into patient-safe "nutrients of concern"
 * findings for Crohn's / IBD, per the IBD-AID review (PMC8100370):
 *   - fat modification: more omega-3, less saturated fat, lower ω6:ω3 ratio
 *   - nutrients commonly depleted in IBD: vitamin D, B12, calcium, iron,
 *     folate, magnesium, zinc, potassium
 *   - irritants to limit: added sugar, caffeine, alcohol
 *
 * Targets are general adult reference intakes used as discussion anchors — NOT
 * personalized medical advice. Everything is framed for clinician conversation.
 *
 * Framework-free so it can run in a server action or a client component.
 */

export type NutrientDirection = 'atLeast' | 'atMost'
export type NutrientStatus = 'low' | 'adequate' | 'high' | 'no-data'

export interface NutrientTarget {
  /** Key on the stored meal `data` jsonb (see saveMacroFactorImport). */
  key: string
  label: string
  unit: string
  target: number
  direction: NutrientDirection
  /** Why this nutrient matters in IBD (patient-safe). */
  ibdContext: string
}

export interface NutrientFinding extends NutrientTarget {
  avg: number | null
  daysWithData: number
  status: NutrientStatus
  note: string
}

export interface NutritionAnalysis {
  daysAnalyzed: number
  daysWithNutritionData: number
  findings: NutrientFinding[]
  gaps: NutrientFinding[]
  ratio: NutrientFinding | null
}

/** Reference targets. `atLeast` = aim for ≥ target; `atMost` = keep ≤ target. */
export const NUTRIENT_TARGETS: readonly NutrientTarget[] = [
  {
    key: 'fiber_g', label: 'Fiber', unit: 'g', target: 25, direction: 'atLeast',
    ibdContext: 'Soluble fiber supports gut bacteria; insoluble fiber may need easing off during a flare.',
  },
  {
    key: 'omega3_g', label: 'Omega-3', unit: 'g', target: 1.6, direction: 'atLeast',
    ibdContext: 'Omega-3 fats are anti-inflammatory — oily fish, walnuts and flax are good sources.',
  },
  {
    key: 'sat_fat_g', label: 'Saturated fat', unit: 'g', target: 22, direction: 'atMost',
    ibdContext: 'High saturated fat leans pro-inflammatory; the IBD-AID suggests limiting it.',
  },
  {
    key: 'added_sugar_g', label: 'Added sugar', unit: 'g', target: 36, direction: 'atMost',
    ibdContext: 'Refined / added sugar is pro-inflammatory and worth limiting.',
  },
  {
    key: 'vitamin_d_mcg', label: 'Vitamin D', unit: 'mcg', target: 15, direction: 'atLeast',
    ibdContext: 'Vitamin D is commonly low in IBD and is often monitored by your GI team.',
  },
  {
    key: 'b12_mcg', label: 'Vitamin B12', unit: 'mcg', target: 2.4, direction: 'atLeast',
    ibdContext: 'B12 absorption can be reduced when Crohn’s affects the ileum; sometimes supplemented.',
  },
  {
    key: 'calcium_mg', label: 'Calcium', unit: 'mg', target: 1000, direction: 'atLeast',
    ibdContext: 'Calcium intake can drop when dairy is limited, and steroids raise the requirement.',
  },
  {
    key: 'iron_mg', label: 'Iron', unit: 'mg', target: 8, direction: 'atLeast',
    ibdContext: 'Iron can run low in IBD from blood loss and malabsorption (anemia risk).',
  },
  {
    key: 'folate_mcg', label: 'Folate', unit: 'mcg', target: 400, direction: 'atLeast',
    ibdContext: 'Some IBD medications (sulfasalazine, methotrexate) lower folate.',
  },
  {
    key: 'magnesium_mg', label: 'Magnesium', unit: 'mg', target: 400, direction: 'atLeast',
    ibdContext: 'Magnesium can be lost with frequent diarrhea.',
  },
  {
    key: 'zinc_mg', label: 'Zinc', unit: 'mg', target: 11, direction: 'atLeast',
    ibdContext: 'Zinc can be depleted by ongoing diarrhea.',
  },
  {
    key: 'potassium_mg', label: 'Potassium', unit: 'mg', target: 3400, direction: 'atLeast',
    ibdContext: 'Potassium can drop with fluid losses.',
  },
  {
    key: 'caffeine_mg', label: 'Caffeine', unit: 'mg', target: 400, direction: 'atMost',
    ibdContext: 'Caffeine can be a gut irritant and stimulate motility for some people.',
  },
]

/** Special-case omega-6 : omega-3 ratio (lower is less inflammatory). */
const RATIO_TARGET = 4

function mean(values: number[]): number {
  return values.reduce((a, b) => a + b, 0) / values.length
}

function round(n: number): number {
  return n >= 100 ? Math.round(n) : Math.round(n * 10) / 10
}

function statusFor(avg: number, t: NutrientTarget): NutrientStatus {
  if (t.direction === 'atLeast') return avg < t.target * 0.8 ? 'low' : 'adequate'
  return avg > t.target ? 'high' : 'adequate'
}

function noteFor(avg: number, t: NutrientTarget, status: NutrientStatus): string {
  const a = `${round(avg)}${t.unit}`
  const tgt = `${t.target}${t.unit}`
  if (status === 'low') return `Averaging ${a}/day, below the ~${tgt} reference. ${t.ibdContext}`
  if (status === 'high') return `Averaging ${a}/day, above the ~${tgt} reference. ${t.ibdContext}`
  return `Averaging ${a}/day (around the ${tgt} reference). ${t.ibdContext}`
}

interface EntryLike {
  entryType: string
  data: unknown
}

/** Average a numeric meal-data field across entries that report it. */
function collect(meals: Record<string, unknown>[], key: string): number[] {
  const out: number[] = []
  for (const d of meals) {
    const v = d[key]
    if (typeof v === 'number' && Number.isFinite(v)) out.push(v)
  }
  return out
}

/**
 * Analyze recent entries for IBD nutrient gaps. Only meal entries that carry the
 * micronutrient panel (i.e. MacroFactor imports) contribute; days without that
 * data are simply not counted.
 */
export function analyzeNutrition(entries: EntryLike[], days: number): NutritionAnalysis {
  const meals = entries
    .filter((e) => e.entryType === 'meal')
    .map((e) => (e.data ?? {}) as Record<string, unknown>)

  const findings: NutrientFinding[] = []
  for (const t of NUTRIENT_TARGETS) {
    const values = collect(meals, t.key)
    if (values.length === 0) {
      findings.push({ ...t, avg: null, daysWithData: 0, status: 'no-data', note: '' })
      continue
    }
    const avg = mean(values)
    const status = statusFor(avg, t)
    findings.push({ ...t, avg: round(avg), daysWithData: values.length, status, note: noteFor(avg, t, status) })
  }

  // Omega-6 : omega-3 ratio.
  let ratio: NutrientFinding | null = null
  const o6 = collect(meals, 'omega6_g')
  const o3 = collect(meals, 'omega3_g')
  if (o6.length > 0 && o3.length > 0 && mean(o3) > 0) {
    const r = mean(o6) / mean(o3)
    const t: NutrientTarget = {
      key: 'omega6_omega3_ratio',
      label: 'Omega-6 : Omega-3 ratio',
      unit: ':1',
      target: RATIO_TARGET,
      direction: 'atMost',
      ibdContext: 'A high omega-6 to omega-3 ratio leans pro-inflammatory; more omega-3 lowers it.',
    }
    const status: NutrientStatus = r > RATIO_TARGET ? 'high' : 'adequate'
    ratio = {
      ...t,
      avg: round(r),
      daysWithData: Math.min(o6.length, o3.length),
      status,
      note:
        status === 'high'
          ? `Averaging ${round(r)}:1, above the ~${RATIO_TARGET}:1 reference. ${t.ibdContext}`
          : `Averaging ${round(r)}:1 (at or below ~${RATIO_TARGET}:1). ${t.ibdContext}`,
    }
  }

  const withData = findings.filter((f) => f.status !== 'no-data')
  const gaps = withData.filter((f) => f.status === 'low' || f.status === 'high')
  if (ratio && ratio.status === 'high') gaps.push(ratio)

  const daysWithNutritionData = Math.max(0, ...findings.map((f) => f.daysWithData))

  return {
    daysAnalyzed: days,
    daysWithNutritionData,
    findings: withData,
    gaps,
    ratio,
  }
}
