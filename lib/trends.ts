/**
 * Crohn's-relevant food & exercise trends over a set of entries.
 *
 * Food: how anti-inflammatory the diet leaned (IBD-AID), the direction vs. the
 * first half of the window, and the most common pro-inflammatory triggers.
 * Exercise: active days, total/average minutes, intensity mix, and direction —
 * since regular moderate movement is associated with staying in remission.
 *
 * Framework-free and pure (no Date.now): the caller decides the window by passing
 * the already-filtered entries. Shared by the timeline card and the voice/chat tools.
 */

import { tagLabel, tagLean } from '@/lib/ibd-aid'

interface EntryLike {
  entryType: string
  data: unknown
  loggedAt: string | Date
}

export type TrendDir = 'up' | 'down' | 'flat' | null

export interface FoodExerciseTrends {
  meals: {
    total: number
    anti: number
    neutral: number
    pro: number
    antiPct: number
    antiTrend: TrendDir
    topTriggers: { tag: string; label: string; count: number }[]
  }
  exercise: {
    sessions: number
    activeDays: number
    totalMinutes: number
    avgMinutesPerActiveDay: number
    byIntensity: Record<string, number>
    trend: TrendDir
  }
}

const obj = (v: unknown): Record<string, unknown> => (v && typeof v === 'object' ? (v as Record<string, unknown>) : {})
const dayKey = (d: string | Date) => new Date(d).toISOString().slice(0, 10)

function dir(firstHalf: number, secondHalf: number, eps = 0.05): TrendDir {
  if (firstHalf === 0 && secondHalf === 0) return null
  if (secondHalf > firstHalf + eps) return 'up'
  if (secondHalf < firstHalf - eps) return 'down'
  return 'flat'
}

export function computeFoodExerciseTrends(entries: EntryLike[]): FoodExerciseTrends {
  const sorted = [...entries].sort(
    (a, b) => new Date(a.loggedAt).getTime() - new Date(b.loggedAt).getTime()
  )

  // ── Meals ──────────────────────────────────────────────────────────────────
  const meals = sorted.filter((e) => e.entryType === 'meal')
  let anti = 0, neutral = 0, pro = 0
  const triggerCounts = new Map<string, number>()
  for (const m of meals) {
    const d = obj(m.data)
    const cls = String(d.food_class ?? 'neutral')
    if (cls === 'anti-inflammatory') anti++
    else if (cls === 'pro-inflammatory') pro++
    else neutral++
    const tags = Array.isArray(d.tags) ? d.tags.map(String) : []
    for (const t of tags) {
      if (tagLean(t) === 'pro-inflammatory') triggerCounts.set(t, (triggerCounts.get(t) ?? 0) + 1)
    }
  }
  const total = meals.length
  const antiPct = total ? Math.round((anti / total) * 100) : 0
  // anti-inflammatory share, first half vs second half of the window
  const firstMeals = meals.slice(0, Math.floor(meals.length / 2))
  const secondMeals = meals.slice(Math.floor(meals.length / 2))
  const share = (arr: EntryLike[]) =>
    arr.length ? arr.filter((m) => String(obj(m.data).food_class) === 'anti-inflammatory').length / arr.length : 0
  const antiTrend = dir(share(firstMeals), share(secondMeals))
  const topTriggers = [...triggerCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([tag, count]) => ({ tag, label: tagLabel(tag), count }))

  // ── Exercise ─────────────────────────────────────────────────────────────-
  const ex = sorted.filter((e) => e.entryType === 'exercise')
  const activeDaySet = new Set<string>()
  const byIntensity: Record<string, number> = {}
  let totalMinutes = 0
  for (const e of ex) {
    const d = obj(e.data)
    activeDaySet.add(dayKey(e.loggedAt))
    totalMinutes += Number(d.duration_minutes ?? 0) || 0
    const intensity = String(d.intensity ?? 'unspecified')
    byIntensity[intensity] = (byIntensity[intensity] ?? 0) + 1
  }
  const firstEx = ex.slice(0, Math.floor(ex.length / 2))
  const secondEx = ex.slice(Math.floor(ex.length / 2))
  const exTrend = dir(firstEx.length, secondEx.length, 0.5)
  const activeDays = activeDaySet.size

  return {
    meals: { total, anti, neutral, pro, antiPct, antiTrend, topTriggers },
    exercise: {
      sessions: ex.length,
      activeDays,
      totalMinutes,
      avgMinutesPerActiveDay: activeDays ? Math.round(totalMinutes / activeDays) : 0,
      byIntensity,
      trend: exTrend,
    },
  }
}

/** One-line plain-language summary for the AI assistant. */
export function trendsSummaryLine(t: FoodExerciseTrends): string {
  const parts: string[] = []
  if (t.meals.total) {
    parts.push(
      `${t.meals.antiPct}% of ${t.meals.total} logged meals leaned anti-inflammatory${
        t.meals.antiTrend === 'up' ? ' (improving)' : t.meals.antiTrend === 'down' ? ' (declining)' : ''
      }${t.meals.topTriggers.length ? `; common triggers: ${t.meals.topTriggers.map((x) => `${x.label} ×${x.count}`).join(', ')}` : ''}`
    )
  }
  if (t.exercise.sessions) {
    parts.push(
      `${t.exercise.activeDays} active day${t.exercise.activeDays === 1 ? '' : 's'}, ${t.exercise.totalMinutes} min total${
        t.exercise.trend === 'up' ? ' (more active lately)' : t.exercise.trend === 'down' ? ' (less active lately)' : ''
      }`
    )
  }
  return parts.join('. ') || 'Not enough food or exercise logged yet to show trends.'
}
