/**
 * Seed the bundled Fasten FHIR sample into the DB so the medical-records
 * intelligence (labs section, trend charts, lab-informed guidance) has data to
 * work with without a live portal connection. Mirrors saveFastenImport's storage
 * shape. Idempotent: clears prior source='fasten' entries first.
 *
 * Run: node --env-file=.env scripts/seed-fasten.mjs
 */
import pg from 'pg'

// Labs: name, value, unit, date, canonicalKey. (CRP has two points → a trend.)
const LABS = [
  ['C-reactive protein', 3.1, 'mg/L', '2026-03-04', 'crp'],
  ['C-reactive protein', 12.4, 'mg/L', '2026-06-02', 'crp'],
  ['Fecal calprotectin', 280, 'ug/g', '2026-05-20', 'calprotectin'],
  ['Ferritin', 18, 'ng/mL', '2026-06-02', 'ferritin'],
  ['Hemoglobin', 12.9, 'g/dL', '2026-06-02', 'hemoglobin'],
  ['Leukocytes (WBC)', 8.1, '10*3/uL', '2026-06-02', 'wbc'],
]
const CLINICAL = [
  ['condition', "Crohn's disease of small intestine", '2021-05-01'],
  ['encounter', "GI follow-up for Crohn's disease", '2026-05-18'],
  ['procedure', 'Colonoscopy', '2025-11-07'],
]
const MEDS = [
  ['Adalimumab 40 mg/0.4 mL subcutaneous injection every 14 days', 'active'],
  ['Vitamin D3 2000 IU daily', 'active'],
]

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL })
try {
  await pool.query(`delete from log_entries where patient_id='alex' and source='fasten'`)

  for (const [name, value, unit, date, key] of LABS) {
    const data = { lab_name: name, value, unit, observed_at: date, [key]: value }
    await pool.query(
      `insert into log_entries (patient_id, entry_type, source, data, logged_at)
       values ('alex','lab','fasten',$1::jsonb,$2)`,
      [JSON.stringify(data), `${date}T12:00:00`]
    )
  }
  for (const [kind, text, date] of CLINICAL) {
    await pool.query(
      `insert into log_entries (patient_id, entry_type, source, data, logged_at)
       values ('alex','clinical','fasten',$1::jsonb,$2)`,
      [JSON.stringify({ kind, text, date }), `${date}T12:00:00`]
    )
  }
  for (const [medName, status] of MEDS) {
    const exists = await pool.query(
      `select 1 from medications where patient_id='alex' and med_name=$1`, [medName]
    )
    if (!exists.rowCount) {
      await pool.query(
        `insert into medications (patient_id, med_name, dose, frequency, is_active)
         values ('alex',$1,'—','imported',$2)`,
        [medName, status === 'active']
      )
    }
  }

  console.log(`✓ seeded ${LABS.length} labs, ${CLINICAL.length} clinical records, ${MEDS.length} meds`)
} catch (e) {
  console.error('ERROR:', e.message)
  process.exit(1)
} finally {
  await pool.end()
}
