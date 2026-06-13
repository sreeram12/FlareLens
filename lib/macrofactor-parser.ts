/**
 * MacroFactor export parser.
 *
 * MacroFactor's "Export All" produces a LONG-format table with four columns:
 *
 *     sheet, date, metric, value
 *
 * e.g.  "Calories & Macros", 2026-05-26, "Calories (kcal)", 2466
 *       "Micronutrients",    2026-05-26, "Fiber (g)",       5.3
 *       "Scale Weight",      2026-05-26, "Weight (lbs)",    200.6
 *       "Weight Trend",      2026-05-26, "Trend Weight (lbs)", 200.85
 *       "Expenditure",       2026-05-26, "Expenditure",     2918
 *       "Steps",             2026-04-26, "Steps",           8701
 *
 * We aggregate every (date, metric) pair into one ParsedDay per calendar date.
 * The file may be a .csv or an .xlsx; either way the route hands us row objects
 * keyed by the four column headers.
 *
 * A legacy WIDE format (one column per metric) is still supported as a fallback
 * so older exports keep working.
 */

export interface ParsedDay {
  date: string // YYYY-MM-DD
  calories?: number
  protein?: number
  carbs?: number
  fat?: number
  fiber?: number
  water?: number // grams (≈ mL)
  caffeine?: number // mg
  sodium?: number // mg
  sugars?: number // g
  weightKg?: number
  trendWeightKg?: number
  fatPercent?: number
  expenditure?: number // kcal (TDEE)
  steps?: number
  // ── IBD micronutrient panel (PMC8100370 "nutrients of concern" + fat type) ──
  satFat?: number // g
  transFat?: number // g
  monoFat?: number // g
  polyFat?: number // g
  omega3?: number // g
  omega6?: number // g
  addedSugar?: number // g
  cholesterol?: number // mg
  alcohol?: number // g
  vitaminD?: number // mcg
  b12?: number // mcg
  calcium?: number // mg
  iron?: number // mg
  folate?: number // mcg
  magnesium?: number // mg
  zinc?: number // mg
  potassium?: number // mg
}

type RawRow = Record<string, unknown>
type RawSheet = { name: string; rows: RawRow[] }

/** Normalize a header/metric for fuzzy matching: lowercase, strip non-alphanumerics. */
function norm(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]/g, '')
}

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

/** Parse a date cell into YYYY-MM-DD. Handles Date objects, Excel serials, and strings. */
function toDateStr(val: unknown): string | undefined {
  if (val === null || val === undefined || val === '') return undefined

  if (val instanceof Date && !isNaN(val.getTime())) {
    return val.toISOString().split('T')[0]
  }

  if (typeof val === 'number' && val > 20000 && val < 80000) {
    const ms = Math.round((val - 25569) * 86400 * 1000)
    const d = new Date(ms)
    if (!isNaN(d.getTime())) return d.toISOString().split('T')[0]
  }

  const s = String(val).trim()
  // Fast path for ISO YYYY-MM-DD (avoids timezone shifts from new Date()).
  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`

  const parsed = new Date(s)
  if (!isNaN(parsed.getTime())) return parsed.toISOString().split('T')[0]

  return undefined
}

/**
 * Maps a normalized MacroFactor metric name to a ParsedDay field.
 * Exact-match on the normalized string so "fatg" (the macro) does not collide
 * with "saturatedfatg" / "fatpercent" from the micronutrient sheet.
 */
const METRIC_MAP: Record<string, keyof ParsedDay> = {
  calorieskcal: 'calories',
  calories: 'calories',
  proteing: 'protein',
  carbsg: 'carbs',
  carbohydratesg: 'carbs',
  fatg: 'fat',
  fiberg: 'fiber',
  fibreg: 'fiber',
  waterg: 'water',
  waterml: 'water',
  caffeinemg: 'caffeine',
  sodiummg: 'sodium',
  sugarsg: 'sugars',
  weightlbs: 'weightKg',
  weightkg: 'weightKg',
  weight: 'weightKg',
  trendweightlbs: 'trendWeightKg',
  trendweightkg: 'trendWeightKg',
  fatpercent: 'fatPercent',
  bodyfat: 'fatPercent',
  expenditure: 'expenditure',
  steps: 'steps',
  // IBD micronutrient panel (exact normalized MacroFactor header names)
  saturatedfatg: 'satFat',
  transfatg: 'transFat',
  monounsaturatedfatg: 'monoFat',
  polyunsaturatedfatg: 'polyFat',
  omega3g: 'omega3',
  omega6g: 'omega6',
  sugarsaddedg: 'addedSugar',
  cholesterolmg: 'cholesterol',
  alcoholg: 'alcohol',
  vitamindmcg: 'vitaminD',
  b12cobalaminmcg: 'b12',
  calciummg: 'calcium',
  ironmg: 'iron',
  folatemcg: 'folate',
  magnesiummg: 'magnesium',
  zincmg: 'zinc',
  potassiummg: 'potassium',
}

/** Which fields arrive in pounds and must be converted to kg downstream. */
const LBS_METRICS = new Set(['weightlbs', 'trendweightlbs'])

/**
 * Detect whether a set of rows is in LONG format
 * (has metric + value columns) vs WIDE (one column per metric).
 */
function isLongFormat(row: RawRow): boolean {
  return findKey(row, ['metric']) !== undefined && findKey(row, ['value']) !== undefined
}

export function parseMacroFactorSheets(sheets: RawSheet[]): {
  days: ParsedDay[]
  detectedColumns: string[]
  sheetSummary: { name: string; rows: number; matched: string[] }[]
} {
  // Flatten every sheet's rows; the export is usually a single CSV sheet anyway.
  const allRows: RawRow[] = sheets.flatMap((s) => s.rows)
  const firstRow = allRows.find((r) => Object.keys(r).length > 0)

  if (firstRow && isLongFormat(firstRow)) {
    return parseLong(allRows)
  }
  return parseWide(sheets)
}

// ── LONG format: sheet, date, metric, value ──────────────────────────────────
function parseLong(rows: RawRow[]): ReturnType<typeof parseMacroFactorSheets> {
  const byDate = new Map<string, ParsedDay>()
  const detected = new Set<string>()
  const sheetCounts = new Map<string, { rows: number; matched: Set<string> }>()

  const sample = rows.find((r) => Object.keys(r).length > 0) ?? {}
  const dateKey = findKey(sample, ['date'])!
  const metricKey = findKey(sample, ['metric'])!
  const valueKey = findKey(sample, ['value'])!
  const sheetKey = findKey(sample, ['sheet', 'category'])

  for (const row of rows) {
    const date = toDateStr(row[dateKey])
    const metricRaw = row[metricKey]
    if (!date || metricRaw === undefined || metricRaw === null || metricRaw === '') continue

    const sheetName = sheetKey ? String(row[sheetKey] ?? 'Data') : 'Data'
    const counter = sheetCounts.get(sheetName) ?? { rows: 0, matched: new Set<string>() }
    counter.rows++
    sheetCounts.set(sheetName, counter)

    const field = METRIC_MAP[norm(String(metricRaw))]
    if (!field) continue

    let value = toNumber(row[valueKey])
    if (value === undefined) continue

    // Convert pound weights to kg at parse time.
    if (LBS_METRICS.has(norm(String(metricRaw)))) {
      value = Math.round(value * 0.453592 * 10) / 10
    }

    const day = byDate.get(date) ?? { date }
    ;(day[field] as number) = value
    byDate.set(date, day)

    detected.add(field)
    counter.matched.add(field)
  }

  const days = Array.from(byDate.values()).sort((a, b) => a.date.localeCompare(b.date))
  const sheetSummary = Array.from(sheetCounts.entries()).map(([name, c]) => ({
    name,
    rows: c.rows,
    matched: Array.from(c.matched),
  }))

  return { days, detectedColumns: Array.from(detected), sheetSummary }
}

// ── WIDE format (the real MacroFactor .xlsx: one sheet per topic, one column
//    per metric). Columns are matched to ParsedDay fields by EXACT normalized
//    name via METRIC_MAP — no fuzzy `includes`, so "Saturated Fat (g)" can never
//    overwrite total "Fat (g)". ──────────────────────────────────────────────
function parseWide(sheets: RawSheet[]): ReturnType<typeof parseMacroFactorSheets> {
  const byDate = new Map<string, ParsedDay>()
  const detected = new Set<string>()
  const sheetSummary: { name: string; rows: number; matched: string[] }[] = []

  for (const sheet of sheets) {
    if (!sheet.rows.length) { sheetSummary.push({ name: sheet.name, rows: 0, matched: [] }); continue }
    const sample = sheet.rows[0]

    const dateKey = Object.keys(sample).find((k) => {
      const nk = norm(k)
      return nk === 'date' || nk === 'day' || nk.includes('date')
    })
    if (!dateKey) { sheetSummary.push({ name: sheet.name, rows: sheet.rows.length, matched: [] }); continue }

    // Map each column to a field by exact normalized header name.
    const colMap = new Map<string, keyof ParsedDay>()
    const matched: string[] = []
    for (const key of Object.keys(sample)) {
      if (key === dateKey) continue
      const field = METRIC_MAP[norm(key)]
      if (field) { colMap.set(key, field); matched.push(field); detected.add(field) }
    }
    sheetSummary.push({ name: sheet.name, rows: sheet.rows.length, matched })

    for (const row of sheet.rows) {
      const date = toDateStr(row[dateKey])
      if (!date) continue
      const day = byDate.get(date) ?? { date }
      for (const [colKey, field] of colMap) {
        let v = toNumber(row[colKey])
        if (v === undefined) continue
        if (LBS_METRICS.has(norm(colKey))) {
          v = Math.round(v * 0.453592 * 10) / 10
        }
        ;(day[field] as number) = v
      }
      byDate.set(date, day)
    }
  }

  const days = Array.from(byDate.values()).sort((a, b) => a.date.localeCompare(b.date))
  return { days, detectedColumns: Array.from(detected), sheetSummary }
}

/** Heuristic: if a weight looks like pounds (> ~120), convert to kg. */
export function normalizeWeight(weight: number): number {
  return weight > 120 ? Math.round(weight * 0.453592 * 10) / 10 : weight
}
