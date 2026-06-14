/**
 * FlareLens health-entry schema — the single source of truth for what a logged
 * health event contains, how it is edited, and how the AI is told to extract it.
 *
 * Consumed by:
 *   - the extractors (parse-log route, chat tool, voice agent, vision route) via
 *     EXTRACTION_FIELD_GUIDE so every entry path produces the same shape;
 *   - the editable preview (log-entry-preview) via FIELD_SPECS so voice mistakes
 *     can be corrected with the right control (dropdown / chips / slider);
 *   - the manual form via the same enums.
 *
 * This module is intentionally framework-free (no 'use server'/'use client') so
 * both server routes and client components can import it.
 */

import {
  FOOD_CLASSES,
  IBD_FOOD_TAGS,
  IBD_FOOD_TAG_IDS,
  type FoodClass,
} from '@/lib/ibd-aid'

// ─── Enums (single source of truth for option lists) ─────────────────────────

export const MEAL_TYPES = ['breakfast', 'lunch', 'dinner', 'snack'] as const
export type MealType = (typeof MEAL_TYPES)[number]

export const PORTIONS = ['small', 'medium', 'large'] as const
export type Portion = (typeof PORTIONS)[number]

export const EXERCISE_TYPES = [
  'walk',
  'run',
  'cycling',
  'strength',
  'yoga',
  'swimming',
  'sport',
  'other',
] as const
export type ExerciseType = (typeof EXERCISE_TYPES)[number]

export const EXERCISE_FOCUS = [
  'full body',
  'upper body',
  'lower body',
  'core',
  'cardio',
  'mobility',
] as const

export const INTENSITIES = ['easy', 'moderate', 'hard'] as const
export type Intensity = (typeof INTENSITIES)[number]

export const STOOL_CONSISTENCY = ['formed', 'semi-formed', 'loose', 'watery'] as const

// ─── Entry data shapes (stored in log_entries.data jsonb) ────────────────────

/** Voice/photo/manual meal fields. Macros/micros (MacroFactor) are optional and
 *  layered on top of the same record — see lib/nutrition-analysis for those. */
export interface MealData {
  description: string
  meal_type?: MealType
  portion?: Portion
  food_class?: FoodClass
  tags?: string[]
  calories?: number
}

export interface ExerciseData {
  type?: ExerciseType | string
  focus?: string
  duration_minutes?: number
  intensity?: Intensity
  rpe?: number
  post_workout_fatigue?: number
  steps?: number
}

// ─── Editable-preview field registry ─────────────────────────────────────────

export type FieldEditor =
  | { kind: 'select'; options: readonly string[] }
  | { kind: 'chips'; suggestions: readonly { id: string; label: string }[] }
  | { kind: 'slider'; min: number; max: number }
  | { kind: 'number'; min?: number; max?: number; step?: number }
  | { kind: 'boolean' }
  | { kind: 'text'; multiline?: boolean }

export interface FieldSpec {
  label: string
  editor: FieldEditor
  order: number
}

const TAG_SUGGESTIONS = IBD_FOOD_TAGS.map((t) => ({ id: t.id, label: t.label }))

/**
 * Per-entryType field metadata. Drives the editable preview's control choice and
 * ordering. Fields not listed here still render with an inferred control, so the
 * preview degrades gracefully for unexpected keys.
 */
export const FIELD_SPECS: Record<string, Record<string, FieldSpec>> = {
  meal: {
    description: { label: 'Description', editor: { kind: 'text' }, order: 1 },
    meal_type: { label: 'Meal', editor: { kind: 'select', options: MEAL_TYPES }, order: 2 },
    portion: { label: 'Portion', editor: { kind: 'select', options: PORTIONS }, order: 3 },
    food_class: { label: 'Inflammation', editor: { kind: 'select', options: FOOD_CLASSES }, order: 4 },
    tags: { label: 'IBD tags', editor: { kind: 'chips', suggestions: TAG_SUGGESTIONS }, order: 5 },
    calories: { label: 'Calories (approx)', editor: { kind: 'number', min: 0, step: 10 }, order: 6 },
  },
  exercise: {
    type: { label: 'Type', editor: { kind: 'select', options: EXERCISE_TYPES }, order: 1 },
    focus: { label: 'Focus', editor: { kind: 'select', options: EXERCISE_FOCUS }, order: 2 },
    duration_minutes: { label: 'Duration (min)', editor: { kind: 'number', min: 0, step: 5 }, order: 3 },
    intensity: { label: 'Intensity', editor: { kind: 'select', options: INTENSITIES }, order: 4 },
    rpe: { label: 'Effort (RPE)', editor: { kind: 'slider', min: 0, max: 10 }, order: 5 },
    post_workout_fatigue: { label: 'Post-workout fatigue', editor: { kind: 'slider', min: 0, max: 10 }, order: 6 },
    steps: { label: 'Steps', editor: { kind: 'number', min: 0, step: 100 }, order: 7 },
  },
  symptom: {
    pain_scale: { label: 'Pain', editor: { kind: 'slider', min: 0, max: 10 }, order: 1 },
    fatigue: { label: 'Fatigue', editor: { kind: 'slider', min: 0, max: 10 }, order: 2 },
    bloating: { label: 'Bloating', editor: { kind: 'slider', min: 0, max: 10 }, order: 3 },
    nausea: { label: 'Nausea', editor: { kind: 'slider', min: 0, max: 10 }, order: 4 },
    notes: { label: 'Notes', editor: { kind: 'text', multiline: true }, order: 5 },
  },
  bowel_movement: {
    count: { label: 'Count', editor: { kind: 'number', min: 0, max: 20 }, order: 1 },
    consistency: { label: 'Consistency', editor: { kind: 'select', options: STOOL_CONSISTENCY }, order: 2 },
    urgency: { label: 'Urgency', editor: { kind: 'slider', min: 0, max: 10 }, order: 3 },
    pain_before: { label: 'Pain before', editor: { kind: 'slider', min: 0, max: 10 }, order: 4 },
    blood: { label: 'Blood present', editor: { kind: 'boolean' }, order: 5 },
  },
  medication: {
    med_name: { label: 'Medication', editor: { kind: 'text' }, order: 1 },
    dose: { label: 'Dose', editor: { kind: 'text' }, order: 2 },
    taken: { label: 'Taken', editor: { kind: 'boolean' }, order: 3 },
  },
  sleep: {
    duration_hours: { label: 'Duration (h)', editor: { kind: 'number', min: 0, max: 16, step: 0.5 }, order: 1 },
    quality: { label: 'Quality', editor: { kind: 'slider', min: 0, max: 10 }, order: 2 },
  },
}

/** Look up a field's editor spec, inferring a sensible default for unknown keys. */
export function getFieldSpec(entryType: string, key: string, value: unknown): FieldSpec {
  const known = FIELD_SPECS[entryType]?.[key]
  if (known) return known
  const label = key.replace(/_/g, ' ').replace(/^\w/, (c) => c.toUpperCase())
  if (typeof value === 'boolean') return { label, editor: { kind: 'boolean' }, order: 99 }
  if (typeof value === 'number') return { label, editor: { kind: 'number' }, order: 99 }
  if (Array.isArray(value)) return { label, editor: { kind: 'chips', suggestions: TAG_SUGGESTIONS }, order: 99 }
  return { label, editor: { kind: 'text' }, order: 99 }
}

/**
 * Fields to show in the editable preview, ordered. Returns the UNION of every
 * field defined for the entryType (so the user can fill in details the parser
 * missed — e.g. a vague "log exercise") plus any extra keys present in the data.
 */
export function orderedFields(entryType: string, data: Record<string, unknown>): string[] {
  const specKeys = Object.keys(FIELD_SPECS[entryType] ?? {})
  const dataKeys = Object.keys(data)
  return Array.from(new Set([...specKeys, ...dataKeys]))
    .filter((k) => k !== 'date' && k !== 'summary') // internal/handled-elsewhere keys
    .sort((a, b) => {
      const oa = FIELD_SPECS[entryType]?.[a]?.order ?? 90
      const ob = FIELD_SPECS[entryType]?.[b]?.order ?? 90
      return oa - ob || a.localeCompare(b)
    })
}

// ─── Shared extraction guide (kept in lock-step with the schema above) ───────

export const ENTRY_TYPES = [
  'bowel_movement',
  'symptom',
  'meal',
  'medication',
  'sleep',
  'exercise',
] as const

/**
 * The data-field contract handed to every extractor (voice transcript, chat,
 * photo). Changing a field here updates all entry paths at once.
 */
export const EXTRACTION_FIELD_GUIDE = `Determine the SINGLE most relevant entryType from: ${ENTRY_TYPES.join(', ')}.
Fill only the fields you can infer from what the user said; omit the rest.

Data fields by entryType:
- bowel_movement: count (int), consistency (${STOOL_CONSISTENCY.map((s) => `"${s}"`).join('|')}), blood (bool), urgency (0-10), pain_before (0-10)
- symptom: pain_scale (0-10), fatigue (0-10), bloating (0-10), nausea (0-10), notes (string)
- meal: description (string), meal_type (${MEAL_TYPES.map((m) => `"${m}"`).join('|')}), portion (${PORTIONS.map((p) => `"${p}"`).join('|')}), food_class (${FOOD_CLASSES.map((c) => `"${c}"`).join('|')}), tags (string[] chosen from: ${IBD_FOOD_TAG_IDS.join(', ')}), calories (int — ONLY if the user clearly states it, otherwise omit)
- medication: med_name (string), dose (string), taken (bool)
- sleep: duration_hours (float), quality (1-10)
- exercise: type (${EXERCISE_TYPES.map((t) => `"${t}"`).join('|')}), focus (string, optional), duration_minutes (int), intensity (${INTENSITIES.map((i) => `"${i}"`).join('|')}), rpe (0-10), post_workout_fatigue (0-10)

For meals, classify food_class using the IBD anti-inflammatory diet (IBD-AID):
- anti-inflammatory: oily fish & omega-3s, olive oil, fermented foods (yogurt, kefir, miso), soluble fiber (oats, bananas, cooked carrots/squash), cooked leafy greens, berries, turmeric, ginger, lean protein.
- pro-inflammatory: fried food, refined sugar, processed & red meat, excess saturated fat, alcohol, ultra-processed snacks.
- neutral: mixed meals or anything that doesn't clearly lean either way.
Add any IBD tags that apply (e.g. dairy, fried, high_fat, fermented, cruciferous).`
