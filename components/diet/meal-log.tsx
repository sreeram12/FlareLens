import { format, isToday, isYesterday, isSameDay } from 'date-fns'
import { Check, AlertTriangle, Utensils } from 'lucide-react'
import type { LogEntry } from '@/lib/db/schema'
import { cn } from '@/lib/utils'
import { evaluateMealForPhase, tagLabel, tagLean, type AidPhase, type FoodClass } from '@/lib/ibd-aid'
import type { FoodExerciseTrends } from '@/lib/trends'

type Data = Record<string, unknown>

function dayLabel(date: Date): string {
  if (isToday(date)) return 'Today'
  if (isYesterday(date)) return 'Yesterday'
  return format(date, 'EEEE, MMM d')
}

function pct(n: number, total: number): string {
  return total ? `${Math.round((n / total) * 100)}%` : '0%'
}

/** The user's actual logged meals + how anti-inflammatory their diet has been. */
export function MealLog({
  meals,
  phase,
  trends,
}: {
  meals: LogEntry[]
  phase: AidPhase
  trends: FoodExerciseTrends
}) {
  const { meals: m } = trends
  const sorted = [...meals].sort((a, b) => new Date(b.loggedAt).getTime() - new Date(a.loggedAt).getTime())

  // Group recent meals by day.
  const groups: { date: Date; items: LogEntry[] }[] = []
  for (const e of sorted) {
    const d = new Date(e.loggedAt)
    const g = groups.find((x) => isSameDay(x.date, d))
    if (g) g.items.push(e)
    else groups.push({ date: d, items: [e] })
  }

  if (meals.length === 0) {
    return (
      <section className="mb-6">
        <h3 className="text-sm font-semibold text-foreground mb-3">What you&apos;ve been eating</h3>
        <div className="rounded-xl border border-border bg-card p-6 text-center">
          <Utensils className="mx-auto mb-2 h-6 w-6 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">No meals logged yet. Snap a photo or just say what you ate on the Talk page.</p>
        </div>
      </section>
    )
  }

  return (
    <section className="mb-6">
      <h3 className="text-sm font-semibold text-foreground mb-3">What you&apos;ve been eating</h3>

      {/* Balance summary */}
      <div className="rounded-xl border border-border bg-card p-4 mb-3">
        <div className="flex items-center justify-between gap-2 mb-2">
          <span className="text-xs text-muted-foreground">
            <span className="font-semibold text-foreground">{m.total}</span> meals logged ·{' '}
            <span className="font-semibold text-emerald-400">{m.antiPct}%</span> anti-inflammatory
            {m.antiTrend === 'up' ? ' ↑' : m.antiTrend === 'down' ? ' ↓' : ''}
          </span>
        </div>
        <div className="flex h-2 w-full overflow-hidden rounded-full bg-muted">
          <span className="bg-emerald-400" style={{ width: pct(m.anti, m.total) }} title={`${m.anti} anti-inflammatory`} />
          <span className="bg-muted-foreground/40" style={{ width: pct(m.neutral, m.total) }} title={`${m.neutral} neutral`} />
          <span className="bg-orange-400" style={{ width: pct(m.pro, m.total) }} title={`${m.pro} pro-inflammatory`} />
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
          <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-emerald-400" /> {m.anti} anti-inflammatory</span>
          <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-muted-foreground/40" /> {m.neutral} neutral</span>
          <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-orange-400" /> {m.pro} to limit</span>
        </div>
        {m.topTriggers.length > 0 && (
          <p className="mt-2 pt-2 border-t border-border text-[11px] text-muted-foreground">
            Most common triggers: {m.topTriggers.map((t) => `${t.label} ×${t.count}`).join(', ')}
          </p>
        )}
      </div>

      {/* Meal history grouped by day */}
      <div className="flex flex-col gap-3">
        {groups.slice(0, 10).map(({ date, items }) => (
          <div key={date.toISOString()}>
            <p className="label-mono mb-1.5">{dayLabel(date)}</p>
            <div className="flex flex-col gap-2">
              {items.map((entry) => (
                <MealRow key={entry.id} entry={entry} phase={phase} />
              ))}
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}

function MealRow({ entry, phase }: { entry: LogEntry; phase: AidPhase }) {
  const d = (entry.data ?? {}) as Data
  const tags = Array.isArray(d.tags) ? d.tags.map(String) : []
  const foodClass = typeof d.food_class === 'string' ? (d.food_class as FoodClass) : undefined
  const verdict = foodClass || tags.length ? evaluateMealForPhase(foodClass, tags, phase) : null

  const macros = [
    d.calories != null ? `${Math.round(Number(d.calories))} kcal` : null,
    d.protein_g != null ? `P ${d.protein_g}g` : null,
    d.fiber_g != null ? `Fiber ${d.fiber_g}g` : null,
  ].filter(Boolean).join(' · ')

  return (
    <div className="rounded-lg border border-border bg-card p-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-medium text-foreground">{String(d.description ?? 'Meal')}</p>
          <p className="text-[11px] text-muted-foreground capitalize">
            {String(d.meal_type ?? 'meal')} · {format(new Date(entry.loggedAt), 'h:mm a')}
            {macros ? ` · ${macros}` : ''}
          </p>
        </div>
        {verdict && (
          <span
            className={cn(
              'shrink-0 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold',
              verdict.tone === 'emerald' ? 'bg-emerald-500/10 text-emerald-400'
                : verdict.tone === 'yellow' ? 'bg-yellow-500/10 text-yellow-400'
                : verdict.tone === 'orange' ? 'bg-orange-500/10 text-orange-400'
                : 'bg-muted text-muted-foreground'
            )}
          >
            {verdict.kind === 'good' ? <Check className="h-3 w-3" strokeWidth={2.6} /> : verdict.kind === 'ok' ? null : <AlertTriangle className="h-3 w-3" strokeWidth={2.6} />}
            {verdict.label}
          </span>
        )}
      </div>
      {tags.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {tags.map((t) => {
            const lean = tagLean(t)
            return (
              <span
                key={t}
                className={cn(
                  'rounded-full px-2 py-0.5 text-[10px] font-medium',
                  lean === 'anti-inflammatory' ? 'bg-emerald-500/10 text-emerald-300'
                    : lean === 'pro-inflammatory' ? 'bg-orange-500/10 text-orange-300'
                    : 'bg-muted text-muted-foreground'
                )}
              >
                {tagLabel(t)}
              </span>
            )
          })}
        </div>
      )}
    </div>
  )
}
