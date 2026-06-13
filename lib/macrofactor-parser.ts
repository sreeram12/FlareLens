/**
 * MacroFactor Excel export parser.
 *
 * MacroFactor exports vary, but generally include some combination of:
 *   - A nutrition sheet: Date, Calories (kcal), Protein, Carbs, Fat, Fiber
 *   - A weight sheet: Date, Scale Weight and/or Trend Weight
 *   - An expenditure sheet: Date, Expenditure (TDEE)
 *
 * Rather than assume an exact layout, we scan every sheet and fuzzy-match
 * column headers, then merge rows by calendar date. This keeps the importer
 * resilient to MacroFactor changing column names or sheet order.
 */

export interface ParsedDay {
  date: string // YYYY-MM-DD
  calories?: number
  protein?: number
  carbs?: number
  fat?: number
  fiber?: number
  weightKg?: number
  trendWeightKg?: number
  expenditure?: number
  steps?: number
}

// Raw shape coming out of `xlsx` sheet_to_json: array of objects keyed by header.
type RawRow = Record<string, unknown>
type RawSheet = { name: string; rows: RawRow[] }

/** Normalize a header for fuzzy matching: lowercase, strip non-alphanumerics. */
function norm(h: string): string {
  return h.toLowerCase().replace(/[^a-z0-9]/g, '')
}

/** Find the first key in a row whose normalized header matches any candidate. */
function findKey(row: RawRow, candidates: string[]): string | undefined {
  const keys = Object.keys(row)
  for (const cand of candidates) {
    const c = norm(cand)
    const match = keys.find((k) => {
      const nk = norm(k)
      return nk === c || nk.includes(c)
    })
    if (match) return match
  }
  return undefined
}

function toNumber(val: unknown): number | undefined {
  if (val === null || val === undefined || val === '') return undefined
  const n = typeof val === 'number' ? val : parseFloat(String(val).replace(/[^0-9.\-]/g, ''))
  return Number.isFinite(n) ? n : undefined
}

/**
 * Parse a date cell into YYYY-MM-DD.
 * Handles JS Date objects, Excel serial numbers, and common string formats.
 */
function toDateStr(val: unknown): string | undefined {
  if (val === null || val === undefined || val === '') return undefined

  // Already a Date (xlsx with cellDates: true)
  if (val instanceof Date && !isNaN(val.getTime())) {
    return val.toISOString().split('T')[0]
  }

  // Excel serial date number (days since 1899-12-30)
  if (typeof val === 'number' && val > 20000 && val < 80000) {
    const ms = Math.round((val - 25569) * 86400 * 1000)
    const d = new Date(ms)
    if (!isNaN(d.getTime())) return d.toISOString().split('T')[0]
  }

  // String date
  const s = String(val).trim()
  const parsed = new Date(s)
  if (!isNaN(parsed.getTime())) return parsed.toISOString().split('T')[0]

  return undefined
}

const DATE_HEADERS = ['date', 'day', 'logdate', 'datetime']
const CAL_HEADERS = ['calories', 'energy', 'kcal', 'caloriesconsumed', 'intake']
const PROTEIN_HEADERS = ['protein', 'proteing']
const CARB_HEADERS = ['carbs', 'carbohydrate', 'carbohydrates', 'netcarbs']
const FAT_HEADERS = ['fat', 'fats', 'totalfat']
const FIBER_HEADERS = ['fiber', 'fibre']
const WEIGHT_HEADERS = ['scaleweight', 'weight', 'bodyweight']
const TREND_HEADERS = ['trendweight', 'trend']
const EXPENDITURE_HEADERS = ['expenditure', 'tdee', 'energyexpenditure']
const STEPS_HEADERS = ['steps', 'stepcount']

/**
 * Merge all sheets into a single map of date -> ParsedDay.
 * Each sheet contributes whatever columns it has for that date.
 */
export function parseMacroFactorSheets(sheets: RawSheet[]): {
  days: ParsedDay[]
  detectedColumns: string[]
  sheetSummary: { name: string; rows: number; matched: string[] }[]
} {
  const byDate = new Map<string, ParsedDay>()
  const detected = new Set<string>()
  const sheetSummary: { name: string; rows: number; matched: string[] }[] = []

  for (const sheet of sheets) {
    if (!sheet.rows.length) {
      sheetSummary.push({ name: sheet.name, rows: 0, matched: [] })
      continue
    }

    const sample = sheet.rows[0]
    const dateKey = findKey(sample, DATE_HEADERS)
    const matched: string[] = []
    if (!dateKey) {
      sheetSummary.push({ name: sheet.name, rows: sheet.rows.length, matched: [] })
      continue
    }

    const calKey = findKey(sample, CAL_HEADERS)
    const proteinKey = findKey(sample, PROTEIN_HEADERS)
    const carbKey = findKey(sample, CARB_HEADERS)
    const fatKey = findKey(sample, FAT_HEADERS)
    const fiberKey = findKey(sample, FIBER_HEADERS)
    const weightKey = findKey(sample, WEIGHT_HEADERS)
    const trendKey = findKey(sample, TREND_HEADERS)
    const expKey = findKey(sample, EXPENDITURE_HEADERS)
    const stepsKey = findKey(sample, STEPS_HEADERS)

    if (calKey) { matched.push('calories'); detected.add('calories') }
    if (proteinKey) { matched.push('protein'); detected.add('protein') }
    if (carbKey) { matched.push('carbs'); detected.add('carbs') }
    if (fatKey) { matched.push('fat'); detected.add('fat') }
    if (fiberKey) { matched.push('fiber'); detected.add('fiber') }
    if (weightKey) { matched.push('weight'); detected.add('weight') }
    if (trendKey) { matched.push('trendWeight'); detected.add('trendWeight') }
    if (expKey) { matched.push('expenditure'); detected.add('expenditure') }
    if (stepsKey) { matched.push('steps'); detected.add('steps') }

    sheetSummary.push({ name: sheet.name, rows: sheet.rows.length, matched })

    for (const row of sheet.rows) {
      const date = toDateStr(row[dateKey])
      if (!date) continue

      const existing = byDate.get(date) ?? { date }

      if (calKey) { const v = toNumber(row[calKey]); if (v !== undefined) existing.calories = v }
      if (proteinKey) { const v = toNumber(row[proteinKey]); if (v !== undefined) existing.protein = v }
      if (carbKey) { const v = toNumber(row[carbKey]); if (v !== undefined) existing.carbs = v }
      if (fatKey) { const v = toNumber(row[fatKey]); if (v !== undefined) existing.fat = v }
      if (fiberKey) { const v = toNumber(row[fiberKey]); if (v !== undefined) existing.fiber = v }
      if (weightKey) { const v = toNumber(row[weightKey]); if (v !== undefined) existing.weightKg = v }
      if (trendKey) { const v = toNumber(row[trendKey]); if (v !== undefined) existing.trendWeightKg = v }
      if (expKey) { const v = toNumber(row[expKey]); if (v !== undefined) existing.expenditure = v }
      if (stepsKey) { const v = toNumber(row[stepsKey]); if (v !== undefined) existing.steps = v }

      byDate.set(date, existing)
    }
  }

  const days = Array.from(byDate.values())
    .filter((d) => d.calories !== undefined || d.weightKg !== undefined || d.trendWeightKg !== undefined || d.steps !== undefined)
    .sort((a, b) => a.date.localeCompare(b.date))

  return { days, detectedColumns: Array.from(detected), sheetSummary }
}

/** Heuristic: if weights look like pounds (> ~120), convert to kg. */
export function normalizeWeight(weight: number): number {
  return weight > 120 ? Math.round(weight * 0.453592 * 10) / 10 : weight
}
