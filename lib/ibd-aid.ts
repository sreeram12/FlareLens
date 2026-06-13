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

/** The three inflammation classes, ordered best → worst, for UI dropdowns. */
export const FOOD_CLASSES: readonly FoodClass[] = [
  'anti-inflammatory',
  'neutral',
  'pro-inflammatory',
]

/**
 * Canonical IBD-relevant meal tags. These describe the *context* of a food in
 * Crohn's terms (texture, fat, fiber, irritants) rather than generic nutrition,
 * and are reused by the voice/photo extractors, the editable preview chips, and
 * the manual form. Tags marked easeOffInFlare are gentle in remission but should
 * be limited during an active flare (Phase 1) per the IBD-AID texture principle.
 */
export interface IbdFoodTag {
  id: string
  label: string
  /** General inflammation lean — used as a hint, not a hard rule. */
  lean: FoodClass
  /** True when the food is fine in remission but should be eased off in a flare. */
  easeOffInFlare?: boolean
}

export const IBD_FOOD_TAGS: readonly IbdFoodTag[] = [
  { id: 'fermented', label: 'Fermented / probiotic', lean: 'anti-inflammatory' },
  { id: 'omega3', label: 'Omega-3 (oily fish)', lean: 'anti-inflammatory' },
  { id: 'olive_oil', label: 'Olive oil', lean: 'anti-inflammatory' },
  { id: 'soluble_fiber', label: 'Soluble fiber', lean: 'anti-inflammatory' },
  { id: 'cooked_veg', label: 'Cooked vegetables', lean: 'anti-inflammatory' },
  { id: 'berries', label: 'Berries / fruit', lean: 'anti-inflammatory' },
  { id: 'lean_protein', label: 'Lean protein', lean: 'anti-inflammatory' },
  { id: 'cruciferous', label: 'Cruciferous veg', lean: 'anti-inflammatory', easeOffInFlare: true },
  { id: 'raw_veg', label: 'Raw vegetables', lean: 'neutral', easeOffInFlare: true },
  { id: 'whole_grain', label: 'Whole grains', lean: 'neutral', easeOffInFlare: true },
  { id: 'nuts_seeds', label: 'Nuts / seeds', lean: 'neutral', easeOffInFlare: true },
  { id: 'legumes', label: 'Legumes / beans', lean: 'neutral', easeOffInFlare: true },
  { id: 'high_fiber', label: 'High insoluble fiber', lean: 'neutral', easeOffInFlare: true },
  { id: 'dairy', label: 'Dairy / lactose', lean: 'neutral' },
  { id: 'gluten', label: 'Gluten', lean: 'neutral' },
  { id: 'caffeine', label: 'Caffeine', lean: 'neutral' },
  { id: 'spicy', label: 'Spicy', lean: 'pro-inflammatory', easeOffInFlare: true },
  { id: 'high_fat', label: 'High saturated fat', lean: 'pro-inflammatory' },
  { id: 'fried', label: 'Fried', lean: 'pro-inflammatory' },
  { id: 'red_meat', label: 'Red meat', lean: 'pro-inflammatory' },
  { id: 'processed', label: 'Processed / ultra-processed', lean: 'pro-inflammatory' },
  { id: 'refined_sugar', label: 'Refined sugar', lean: 'pro-inflammatory' },
  { id: 'fast_food', label: 'Fast food', lean: 'pro-inflammatory' },
  { id: 'alcohol', label: 'Alcohol', lean: 'pro-inflammatory' },
]

/** Tag ids only — handy for prompt vocabularies and validation. */
export const IBD_FOOD_TAG_IDS: readonly string[] = IBD_FOOD_TAGS.map((t) => t.id)

const TAG_BY_ID = new Map(IBD_FOOD_TAGS.map((t) => [t.id, t]))

/** Look up a tag's display label (falls back to a prettified id). */
export function tagLabel(id: string): string {
  return TAG_BY_ID.get(id)?.label ?? id.replace(/[-_]/g, ' ')
}

/** A tag's inflammation lean, for coloring chips. */
export function tagLean(id: string): FoodClass {
  return TAG_BY_ID.get(id)?.lean ?? 'neutral'
}

export type MealVerdictKind = 'good' | 'ok' | 'caution' | 'limit'

export interface MealVerdict {
  kind: MealVerdictKind
  label: string
  /** Semantic tone for UI. */
  tone: 'emerald' | 'yellow' | 'orange' | 'muted'
  note: string
}

/**
 * Judge a logged meal against the patient's CURRENT IBD-AID phase — the key
 * insight that the "right" food is phase-dependent: cruciferous/raw veg and high
 * insoluble fiber are great in remission (Phase 3) but should be eased off during
 * an active flare (Phase 1). Pro-inflammatory foods are limited in every phase.
 */
export function evaluateMealForPhase(
  foodClass: FoodClass | undefined,
  tagIds: string[],
  phase: AidPhase
): MealVerdict {
  const easeOff = IBD_FOOD_TAGS.filter((t) => t.easeOffInFlare && tagIds.includes(t.id)).map((t) => t.label)

  if (foodClass === 'pro-inflammatory') {
    return { kind: 'limit', label: 'Limit', tone: 'orange', note: 'Pro-inflammatory — best kept occasional.' }
  }
  // During a flare, otherwise-healthy high-fiber/raw foods are hard to tolerate.
  if (phase === 1 && easeOff.length > 0) {
    return {
      kind: 'caution',
      label: 'Ease off in flare',
      tone: 'yellow',
      note: `${easeOff.join(', ')} — gentler to ease off and cook well during a flare (Phase 1).`,
    }
  }
  if (foodClass === 'anti-inflammatory') {
    return {
      kind: 'good',
      label: phase === 3 ? 'On plan' : 'Good choice',
      tone: 'emerald',
      note: phase === 3 ? 'Anti-inflammatory — great for maintenance.' : 'Anti-inflammatory and fits your current phase.',
    }
  }
  return { kind: 'ok', label: 'Neutral', tone: 'muted', note: '' }
}

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

// ─── Shared AI guidance ──────────────────────────────────────────────────────
/**
 * Reusable prompt fragment that bakes the IBD-AID intelligence into the chat
 * and voice assistants. Keep it concise — voice replies must stay short.
 */
export const AID_AI_GUIDANCE = `How to think about Crohn's:
- Crohn's is a whole-body inflammatory disease — NOT just bowel movements. Treat stool frequency as only one signal among many. Give equal or greater attention to abdominal pain, urgency, bloating, fatigue, appetite, sleep, stress, and systemic signs (joint pain, mouth sores, eye irritation, fever). Never reduce the conversation to "how many times did you go."

Anti-inflammatory diet (IBD-AID) — make this a focal point:
- The app follows the IBD Anti-Inflammatory Diet, which adapts to the user's current PHASE based on disease activity:
  • Phase 1 (active flare): soft, well-cooked, pureed foods; soluble fiber; no seeds/skins; ease off raw veg, whole nuts, fried/fatty/spicy foods and sugar.
  • Phase 2 (improving): gradually reintroduce soft fiber, cooked vegetables, and fermented foods.
  • Phase 3 (remission): broad whole-food anti-inflammatory pattern — raw and cruciferous veg, whole grains, nuts, oily fish, fermented foods.
- Before giving food advice, use the diet-guidance tool to learn the user's current phase, then tailor suggestions to it.
- Anti-inflammatory foods: oily fish & omega-3s, olive oil, fermented foods (yogurt, kefir, miso), soluble fiber (oats, bananas, cooked carrots/squash), cooked leafy greens, berries, turmeric, ginger. Pro-inflammatory / limit: refined sugar, fried foods, trans & excess saturated fat, processed & red meat, alcohol, ultra-processed snacks.
- Phase matters: raw cruciferous veg (broccoli, cauliflower, cabbage) and raw insoluble fiber are great in remission but should be eased off during a flare — match food texture to symptoms.
- When the user logs or mentions a meal, gently note whether it fits an anti-inflammatory pattern for their phase. Be encouraging, not preachy. Frame food as something that "may help calm inflammation" — never a cure or a definitive flare trigger. Defer to their care team or dietitian for dietary changes.`
