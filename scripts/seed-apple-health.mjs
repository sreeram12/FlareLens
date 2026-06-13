/**
 * Seed real Apple Health wearable data into the app DB for the demo.
 *
 * Takes the densest real RHR+HRV window (2025-04-23 → 2025-06-10) from the
 * extracted daily history and maps it day-for-day onto the 2026 demo window
 * (2026-04-26 → 2026-06-13), so the values are REAL physiology but the dates
 * align with the MacroFactor nutrition data and the Jun-13 flare. The window's
 * tail naturally shows an HRV decline, which lands right before the flare.
 *
 * Writes one `wearable` log entry per day (source 'apple_health'). Idempotent:
 * clears prior apple_health wearable rows first.
 *
 * Run:  node --env-file=.env scripts/seed-apple-health.mjs
 */
import { readFileSync } from 'node:fs'
import pg from 'pg'

const SRC_START = '2025-04-23' // densest real RHR+HRV 49-day window
const TARGET_START = '2026-04-26' // start of the demo window (→ ends 2026-06-13)
const DAYS = 49

const txt = readFileSync('data/apple_health/apple_health_daily.csv', 'utf8')
const [head, ...lines] = txt.trim().split('\n')
const cols = head.split(',')
const ci = (n) => cols.indexOf(n)
const I = {
  date: ci('date'),
  sleep: ci('SleepAsleepHours'),
  rhr: ci('RestingHeartRate'),
  hrv: ci('HeartRateVariabilitySDNN'),
  resp: ci('RespiratoryRate'),
  hrm: ci('HeartRate_mean'),
  steps: ci('StepCount'),
}

const rows = lines.map((l) => l.split(','))
const startIdx = rows.findIndex((r) => r[I.date] === SRC_START)
if (startIdx < 0) {
  console.error(`Source start ${SRC_START} not found in CSV`)
  process.exit(1)
}
const window = rows.slice(startIdx, startIdx + DAYS)

const num = (v) => (v === '' || v === undefined ? undefined : parseFloat(v))
const addDays = (iso, n) => {
  const d = new Date(iso + 'T00:00:00Z')
  d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString().split('T')[0]
}
const round = (v, dp = 1) => (v === undefined ? undefined : Math.round(v * 10 ** dp) / 10 ** dp)
const clean = (o) => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined))

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL })
try {
  await pool.query(
    `delete from log_entries where patient_id='alex' and entry_type='wearable' and source='apple_health'`
  )

  let inserted = 0
  for (let i = 0; i < window.length; i++) {
    const r = window[i]
    const targetDate = addDays(TARGET_START, i)
    const data = clean({
      date: targetDate,
      sleep_hours: round(num(r[I.sleep])),
      resting_hr: round(num(r[I.rhr]), 0),
      hrv: round(num(r[I.hrv]), 0),
      respiratory_rate: round(num(r[I.resp])),
      hr_mean: round(num(r[I.hrm]), 0),
      steps: round(num(r[I.steps]), 0),
      source_date: r[I.date], // provenance: the real date these values came from
    })
    const loggedAt = `${targetDate}T12:00:00`
    await pool.query(
      `insert into log_entries (patient_id, entry_type, source, data, logged_at)
       values ('alex', 'wearable', 'apple_health', $1::jsonb, $2)`,
      [JSON.stringify(data), loggedAt]
    )
    inserted++
  }

  console.log(`✓ Seeded ${inserted} wearable days: ${TARGET_START} → ${addDays(TARGET_START, DAYS - 1)}`)
  console.log(`  (real values from ${SRC_START} → ${window[window.length - 1][I.date]})`)

  // Quick readout of the pre-flare tail.
  const tail = await pool.query(
    `select (data->>'date') d, (data->>'sleep_hours') sleep, (data->>'resting_hr') rhr, (data->>'hrv') hrv
     from log_entries where patient_id='alex' and entry_type='wearable' and source='apple_health'
     and (data->>'date') >= '2026-06-07' order by d`
  )
  console.log('\n  Pre-flare tail (Jun 7–13 2026):')
  for (const t of tail.rows) console.log(`    ${t.d}  sleep ${t.sleep}h  RHR ${t.rhr}  HRV ${t.hrv}`)
} catch (e) {
  console.error('ERROR:', e.message)
  process.exit(1)
} finally {
  await pool.end()
}
