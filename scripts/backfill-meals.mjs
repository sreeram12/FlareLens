/**
 * One-off backfill: add food_class + a few IBD tags to existing meal entries
 * that predate the anti-inflammatory schema, so the timeline shows phase-aware
 * verdicts on seeded meals. Mirrors the keyword logic in lib/ibd-aid (kept
 * compact here — this is a one-shot, not the source of truth).
 *
 * Run: node --env-file=.env scripts/backfill-meals.mjs
 */
import pg from 'pg'

const ANTI = ['salmon', 'mackerel', 'sardine', 'tuna', 'omega', 'olive oil', 'avocado', 'flax', 'chia', 'walnut',
  'yogurt', 'kefir', 'miso', 'kimchi', 'sauerkraut', 'fermented', 'oat', 'banana', 'applesauce', 'lentil',
  'quinoa', 'brown rice', 'spinach', 'kale', 'broccoli', 'carrot', 'squash', 'sweet potato', 'berry',
  'turmeric', 'ginger', 'broth', 'tofu', 'greens']
const PRO = ['sugar', 'candy', 'soda', 'cake', 'cookie', 'pastry', 'donut', 'ice cream', 'fried', 'fries',
  'chips', 'burger', 'pizza', 'bacon', 'sausage', 'hot dog', 'processed', 'salami', 'pepperoni', 'red meat',
  'steak', 'white bread', 'refined', 'pasta', 'margarine', 'alcohol', 'beer', 'wine']

const TAG_RULES = [
  [['yogurt', 'kefir', 'miso', 'kimchi', 'sauerkraut', 'fermented'], 'fermented'],
  [['salmon', 'sardine', 'mackerel', 'tuna', 'fish', 'omega', 'flax', 'walnut', 'chia'], 'omega3'],
  [['olive oil'], 'olive_oil'],
  [['oat', 'banana', 'applesauce'], 'soluble_fiber'],
  [['cheese', 'cream', 'butter', 'milk', 'yogurt', 'kefir'], 'dairy'],
  [['fried', 'fries'], 'fried'],
  [['pizza', 'burger', 'fast food', 'fries'], 'fast_food'],
  [['coffee', 'tea', 'espresso', 'caffeine'], 'caffeine'],
  [['sugar', 'candy', 'soda', 'cake', 'cookie', 'pastry', 'dessert'], 'refined_sugar'],
  [['broccoli', 'cauliflower', 'cabbage', 'brussels'], 'cruciferous'],
  [['salad', 'raw'], 'raw_veg'],
  [['beer', 'wine', 'alcohol'], 'alcohol'],
]

function classify(text) {
  const t = text.toLowerCase()
  const anti = ANTI.some((w) => t.includes(w))
  const pro = PRO.some((w) => t.includes(w))
  if (pro && !anti) return 'pro-inflammatory'
  if (anti && !pro) return 'anti-inflammatory'
  return 'neutral'
}
function tagsFor(text) {
  const t = text.toLowerCase()
  const tags = new Set()
  for (const [words, tag] of TAG_RULES) if (words.some((w) => t.includes(w))) tags.add(tag)
  return [...tags]
}

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL })
try {
  const { rows } = await pool.query(
    `select id, data, raw_transcript from log_entries where patient_id='alex' and entry_type='meal'`
  )
  let updated = 0, skipped = 0
  for (const r of rows) {
    const d = r.data ?? {}
    if (d.food_class) { skipped++; continue } // already classified
    const text = [d.description, d.food, d.name, r.raw_transcript].filter(Boolean).join(' ')
    // Skip the MacroFactor daily-aggregate rows (no real dish to classify).
    if (!text || /daily nutrition/i.test(text)) { skipped++; continue }
    const next = { ...d, food_class: classify(text) }
    const tags = tagsFor(text)
    if (tags.length && !Array.isArray(d.tags)) next.tags = tags
    await pool.query(`update log_entries set data = $1::jsonb where id = $2`, [JSON.stringify(next), r.id])
    updated++
  }
  console.log(`✓ meals backfilled: ${updated} updated, ${skipped} skipped (already classified or aggregate)`)
  // Show the result
  const after = await pool.query(
    `select (data->>'description') d, (data->>'food_class') c, (data->>'tags') t
     from log_entries where patient_id='alex' and entry_type='meal' and data ? 'food_class' order by id limit 12`
  )
  for (const r of after.rows) console.log(`   ${r.c?.padEnd(18)} ${r.d ?? ''}  ${r.t ?? ''}`)
} catch (e) {
  console.error('ERROR:', e.message)
  process.exit(1)
} finally {
  await pool.end()
}
