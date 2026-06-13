/**
 * FlareLens IBD Anti-Inflammatory Diet (IBD-AID) Intelligence
 *
 * Based on the IBD-AID framework described in:
 * "Anti-inflammatory diet and inflammatory bowel disease: what clinicians
 *  and patients should know?" (PMC8100370)
 *
 * Core ideas baked into the app:
 *   - IBD is a whole-body inflammatory disease, not just bowel frequency.
 *   - Diet is phased to match current disease activity:
 *       Phase 1 (Flare)        → soft, well-cooked, pureed, gentle textures
 *       Phase 2 (Reintroduction)→ soft + gradually more fiber & texture
 *       Phase 3 (Maintenance)   → broad whole-food anti-inflammatory pattern
 *   - 5 components: modify carbohydrates, pre/probiotics, modify fats
 *     (more omega-3 / less saturated & omega-6), review whole pattern,
 *     and adjust food texture to symptoms.
 */

export type AidPhase = 1 | 2 | 3

export interface PhaseInfo {
  phase: AidPhase
  name: string
  shortName: string
  /** When this phase applies */
  appliesWhen: string
  /** Texture guidance headline */
  texture: string
  /** One-line summary */
  summary: string
  /** What to emphasize right now */
  emphasize: string[]
  /** What to ease off / avoid in this phase specifically */
  easeOff: string[]
  /** Example meals appropriate for the phase */
  exampleMeals: string[]
  /** Tailwind-ish semantic color token name used for accents */
  accent: 'emerald' | 'yellow' | 'orange'
}

// ─── The 5 components of the IBD-AID ─────────────────────────────────────────
export const AID_PRINCIPLES: { title: string; detail: string }[] = [
  {
    title: 'Modify carbohydrates',
    detail:
      'Limit refined sugar, processed grains, and lactose. Favor soluble-fiber carbs like oats, bananas, and well-cooked vegetables that feed good bacteria without irritating the gut.',
  },
  {
    title: 'Emphasize pre- & probiotics',
    detail:
      'Include fermented foods (yogurt, kefir, miso, sauerkraut) and prebiotic, soluble-fiber foods (leeks, onions, oats) to support a healthy microbiome.',
  },
  {
    title: 'Rebalance dietary fats',
    detail:
      'Increase anti-inflammatory omega-3 fats from oily fish and olive oil. Reduce saturated fat, trans fat, and excess omega-6 from fried and processed foods.',
  },
  {
    title: 'Review the whole pattern',
    detail:
      'Look at the overall diet for missing nutrients and personal intolerances, rather than fixating on single foods.',
  },
  {
    title: 'Adjust texture to symptoms',
    detail:
      'Match food texture to disease activity — soft, pureed, and well-cooked during flares; gradually reintroduce fiber and raw textures as you stabilize.',
  },
]

// ─── Phase definitions ───────────────────────────────────────────────────────
export const PHASES: Record<AidPhase, PhaseInfo> = {
  1: {
    phase: 1,
    name: 'Phase 1 · Flare Support',
    shortName: 'Flare',
    appliesWhen: 'Active symptoms — pain, urgency, frequent or loose stools',
    texture: 'Soft, well-cooked, pureed & blended foods',
    summary:
      'During active disease, give the gut a rest with gentle, easy-to-absorb foods. Smooth textures and soluble fiber are easiest to tolerate.',
    emphasize: [
      'Pureed soups & blended smoothies',
      'Oatmeal, well-cooked rice & soft bananas',
      'Probiotic yogurt & kefir',
      'Lean poached fish & poultry',
      'Bone broth & soft-cooked vegetables (no skins/seeds)',
      'Smooth nut butters',
    ],
    easeOff: [
      'Raw vegetables & fruit skins',
      'Whole nuts, seeds & popcorn',
      'High-insoluble-fiber raw greens',
      'Fried, fatty & spicy foods',
      'Refined sugar & sweetened drinks',
    ],
    exampleMeals: [
      'Blended carrot-ginger soup with soft white rice',
      'Banana & kefir smoothie with smooth peanut butter',
      'Poached salmon with mashed sweet potato',
      'Warm oatmeal with applesauce',
    ],
    accent: 'orange',
  },
  2: {
    phase: 2,
    name: 'Phase 2 · Reintroduction',
    shortName: 'Reintroduction',
    appliesWhen: 'Symptoms improving but not fully settled',
    texture: 'Soft textures, gradually adding fiber',
    summary:
      'As symptoms calm, slowly reintroduce more texture and fiber. Add fermented foods and cooked vegetables to rebuild the microbiome.',
    emphasize: [
      'Well-cooked vegetables (squash, carrots, spinach)',
      'Soft fermented foods (yogurt, kefir, miso)',
      'Oily fish for omega-3s (salmon, sardines)',
      'Soft-cooked legumes & lentils (if tolerated)',
      'Cooked leafy greens for folate',
      'Olive oil & avocado',
    ],
    easeOff: [
      'Large amounts of raw/insoluble fiber at once',
      'Processed & red meats',
      'Saturated & fried fats',
      'Added sugar & refined grains',
      'Alcohol',
    ],
    exampleMeals: [
      'Baked salmon with soft-cooked spinach & quinoa',
      'Lentil & squash stew with olive oil',
      'Greek yogurt with cooked berries & ground flax',
      'Miso soup with soft tofu and well-cooked greens',
    ],
    accent: 'yellow',
  },
  3: {
    phase: 3,
    name: 'Phase 3 · Maintenance',
    shortName: 'Maintenance',
    appliesWhen: 'Remission — stable, minimal symptoms',
    texture: 'Full range of whole foods as tolerated',
    summary:
      'In remission, follow a broad whole-food anti-inflammatory pattern: plenty of plants, omega-3 fats, fermented foods, and lean protein to keep inflammation low.',
    emphasize: [
      'Colorful vegetables & fruit (with skins as tolerated)',
      'Oily fish 2–3× per week',
      'Fermented foods daily',
      'Whole grains, nuts & seeds',
      'Olive oil, avocado & omega-3 fats',
      'Turmeric, ginger & other anti-inflammatory spices',
    ],
    easeOff: [
      'Processed & red meat',
      'Refined sugar & ultra-processed foods',
      'Trans & saturated fats',
      'Artificial sweeteners & emulsifiers',
      'Excess alcohol',
    ],
    exampleMeals: [
      'Salmon bowl with quinoa, roasted veg & olive oil',
      'Kefir smoothie with berries, spinach & chia',
      'Lentil salad with avocado and fermented veg',
      'Turmeric chicken with brown rice & sautéed greens',
    ],
    accent: 'emerald',
  },
}

/**
 * Map current disease-activity (0–100 stability deviation score) to an
 * appropriate IBD-AID phase. Higher score = more active disease = gentler phase.
 */
export function getPhaseForScore(stabilityScore: number): AidPhase {
  if (stabilityScore >= 45) return 1 // flare-level activity
  if (stabilityScore >= 20) return 2 // mild–moderate deviation
  return 3 // stable / remission
}

export function getPhaseInfo(phase: AidPhase): PhaseInfo {
  return PHASES[phase]
}

// ─── Food classification ─────────────────────────────────────────────────────

export type FoodClass = 'anti-inflammatory' | 'pro-inflammatory' | 'neutral'

const ANTI_INFLAMMATORY_TERMS = [
  'salmon', 'mackerel', 'sardine', 'tuna', 'trout', 'herring', 'anchovy', 'omega',
  'olive oil', 'avocado', 'flax', 'chia', 'walnut',
  'yogurt', 'yoghurt', 'kefir', 'miso', 'kimchi', 'sauerkraut', 'kombucha', 'tempeh', 'fermented', 'probiotic',
  'oat', 'oatmeal', 'banana', 'applesauce', 'apple sauce', 'lentil', 'quinoa', 'brown rice',
  'spinach', 'kale', 'broccoli', 'carrot', 'squash', 'sweet potato', 'zucchini', 'leek', 'asparagus',
  'berry', 'berries', 'blueberry', 'strawberry', 'turmeric', 'ginger', 'bone broth', 'broth',
  'leafy green', 'green tea', 'lean chicken', 'lean turkey', 'poached', 'tofu', 'bean',
]

const PRO_INFLAMMATORY_TERMS = [
  'sugar', 'candy', 'soda', 'cola', 'dessert', 'cake', 'cookie', 'pastry', 'donut', 'doughnut', 'ice cream',
  'fried', 'fries', 'deep-fried', 'chips', 'fast food', 'burger', 'pizza',
  'bacon', 'sausage', 'hot dog', 'processed meat', 'deli meat', 'salami', 'pepperoni', 'red meat', 'steak',
  'white bread', 'refined', 'pasta', 'margarine', 'trans fat', 'hydrogenated',
  'alcohol', 'beer', 'wine', 'liquor', 'energy drink',
  'artificial sweetener', 'aspartame', 'sucralose', 'emulsifier',
  'cheese', 'cream', 'butter', 'whole milk',
]

/** Classify a free-text food / meal description into an inflammation category. */
export function classifyFood(text: string): FoodClass {
  const t = text.toLowerCase()
  const anti = ANTI_INFLAMMATORY_TERMS.some((term) => t.includes(term))
  const pro = PRO_INFLAMMATORY_TERMS.some((term) => t.includes(term))
  if (pro && !anti) return 'pro-inflammatory'
  if (anti && !pro) return 'anti-inflammatory'
  if (anti && pro) return 'neutral' // mixed
  return 'neutral'
}

/** Count anti- vs pro-inflammatory mentions across a list of food strings. */
export function scoreFoods(foods: string[]): {
  anti: number
  pro: number
} {
  let anti = 0
  let pro = 0
  for (const f of foods) {
    const c = classifyFood(f)
    if (c === 'anti-inflammatory') anti++
    else if (c === 'pro-inflammatory') pro++
  }
  return { anti, pro }
}

// Quick-reference lists for the Diet tab
export const ANTI_INFLAMMATORY_FOODS: { group: string; items: string[] }[] = [
  { group: 'Omega-3 fats', items: ['Salmon', 'Sardines', 'Mackerel', 'Walnuts', 'Flaxseed', 'Chia seeds', 'Olive oil'] },
  { group: 'Pre- & probiotics', items: ['Yogurt', 'Kefir', 'Miso', 'Sauerkraut', 'Kimchi', 'Leeks', 'Onions'] },
  { group: 'Soluble fiber', items: ['Oats', 'Bananas', 'Applesauce', 'Cooked carrots', 'Squash', 'Lentils'] },
  { group: 'Plants & spices', items: ['Cooked leafy greens', 'Berries', 'Broccoli', 'Turmeric', 'Ginger', 'Green tea'] },
  { group: 'Lean protein', items: ['Poached chicken', 'Turkey', 'Tofu', 'Eggs', 'Bone broth'] },
]

export const PRO_INFLAMMATORY_FOODS: { group: string; items: string[] }[] = [
  { group: 'Refined carbs & sugar', items: ['Added sugar', 'Soda', 'White bread', 'Pastries', 'Candy'] },
  { group: 'Unhealthy fats', items: ['Fried foods', 'Trans fats', 'Margarine', 'Excess saturated fat'] },
  { group: 'Processed & red meat', items: ['Bacon', 'Sausage', 'Deli meat', 'Hot dogs', 'Red meat'] },
  { group: 'Other irritants', items: ['Alcohol', 'Artificial sweeteners', 'Emulsifiers', 'Ultra-processed snacks'] },
]
