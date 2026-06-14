'use client'

import { useMemo, useState } from 'react'
import { format, isToday, isYesterday, isSameDay } from 'date-fns'
import type { LogEntry } from '@/lib/db/schema'
import { cn } from '@/lib/utils'
import {
  Droplets, Heart, Utensils, Pill, Moon, Dumbbell, Activity, Circle, Scale,
  HeartPulse, Check, AlertTriangle, Footprints, Wind, Salad, FlaskConical, Stethoscope,
  ArrowUp, ArrowDown,
} from 'lucide-react'
import { getScoreLabel } from '@/lib/stability-score'
import { flagLab } from '@/lib/labs'
import { evaluateMealForPhase, tagLabel, tagLean, type AidPhase, type FoodClass } from '@/lib/ibd-aid'

type Data = Record<string, unknown>

const ENTRY_META: Record<string, { label: string; icon: React.ElementType; color: string; accent: string }> = {
  bowel_movement: { label: 'Bowel', icon: Droplets, color: 'text-blue-400', accent: 'border-l-blue-400/70' },
  symptom: { label: 'Symptom', icon: Heart, color: 'text-pink-400', accent: 'border-l-pink-400/70' },
  meal: { label: 'Meal', icon: Utensils, color: 'text-teal-400', accent: 'border-l-teal-400/70' },
  medication: { label: 'Medication', icon: Pill, color: 'text-purple-400', accent: 'border-l-purple-400/70' },
  sleep: { label: 'Sleep', icon: Moon, color: 'text-indigo-400', accent: 'border-l-indigo-400/70' },
  exercise: { label: 'Exercise', icon: Dumbbell, color: 'text-emerald-400', accent: 'border-l-emerald-400/70' },
  wearable: { label: 'Wearable', icon: HeartPulse, color: 'text-cyan-400', accent: 'border-l-cyan-400/70' },
  weight: { label: 'Body', icon: Scale, color: 'text-amber-400', accent: 'border-l-amber-400/70' },
  lab: { label: 'Lab', icon: Activity, color: 'text-violet-400', accent: 'border-l-violet-400/70' },
  clinical: { label: 'Record', icon: Activity, color: 'text-violet-400', accent: 'border-l-violet-400/70' },
}

interface ScoreDay {
  date: string
  score: number
  isFlareDay: boolean
}

interface TimelineViewProps {
  entries: LogEntry[]
  scoreHistory: ScoreDay[]
  phase: AidPhase
  phaseName: string
}

type FilterType = 'all' | 'meal' | 'symptom' | 'wearable' | 'bowel_movement' | 'medication' | 'exercise'

const FILTERS: { value: FilterType; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'meal', label: 'Meals' },
  { value: 'symptom', label: 'Symptoms' },
  { value: 'wearable', label: 'Wearables' },
  { value: 'bowel_movement', label: 'Gut' },
  { value: 'medication', label: 'Meds' },
  { value: 'exercise', label: 'Exercise' },
]

function dayLabel(date: Date): string {
  if (isToday(date)) return 'Today'
  if (isYesterday(date)) return 'Yesterday'
  return format(date, 'EEEE, MMM d')
}

function groupByDay(entries: LogEntry[]) {
  const groups: { date: Date; entries: LogEntry[] }[] = []
  for (const entry of entries) {
    const d = new Date(entry.loggedAt)
    const existing = groups.find((g) => isSameDay(g.date, d))
    if (existing) existing.entries.push(entry)
    else groups.push({ date: d, entries: [entry] })
  }
  return groups.sort((a, b) => b.date.getTime() - a.date.getTime())
}

export function TimelineView({ entries, scoreHistory, phase, phaseName }: TimelineViewProps) {
  const [filter, setFilter] = useState<FilterType>('all')
  const [range, setRange] = useState<number>(7)

  const filtered = useMemo(() => {
    // Anchor the range on the most recent entry (pure; avoids Date.now in render).
    const anchor = entries.reduce((m, e) => Math.max(m, new Date(e.loggedAt).getTime()), 0)
    const cutoff = anchor - range * 86_400_000
    return entries.filter(
      (e) => new Date(e.loggedAt).getTime() >= cutoff && (filter === 'all' || e.entryType === filter)
    )
  }, [entries, filter, range])
  const grouped = useMemo(() => groupByDay(filtered), [filtered])
  const scoreMap = useMemo(() => {
    const m: Record<string, ScoreDay> = {}
    for (const s of scoreHistory) m[s.date] = s
    return m
  }, [scoreHistory])

  return (
    <div className="flex flex-col gap-4">
      {/* Phase context for meal verdicts */}
      <div className="flex items-center gap-2 rounded-lg border border-border bg-card/60 px-3 py-2">
        <Salad className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
        <p className="text-xs text-muted-foreground">
          Meals are rated for your current phase — <span className="text-foreground font-medium">{phaseName}</span>
        </p>
      </div>

      {/* Range + filters */}
      <div className="flex items-center gap-1.5">
        <span className="label-mono mr-1">Range</span>
        {[7, 14, 30].map((r) => (
          <button
            key={r}
            onClick={() => setRange(r)}
            className={cn(
              'px-3 py-1.5 rounded-full text-xs font-medium border transition-colors',
              range === r
                ? 'bg-primary/15 border-primary/50 text-primary'
                : 'bg-card border-border text-muted-foreground hover:text-foreground'
            )}
          >
            {r}d
          </button>
        ))}
      </div>

      <div className="flex gap-1.5 overflow-x-auto pb-1 -mx-4 px-4 lg:mx-0 lg:px-0 lg:flex-wrap scrollbar-hide">
        {FILTERS.map((opt) => (
          <button
            key={opt.value}
            onClick={() => setFilter(opt.value)}
            className={cn(
              'flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-medium border transition-colors',
              filter === opt.value
                ? 'bg-primary/15 border-primary/50 text-primary'
                : 'bg-card border-border text-muted-foreground hover:text-foreground'
            )}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {grouped.length === 0 ? (
        <div className="rounded-xl border border-border bg-card p-8 text-center">
          <p className="text-sm text-muted-foreground">No entries found.</p>
        </div>
      ) : (
        // Single chronological column with a vertical spine — reads top-to-bottom,
        // no masonry (which put unrelated dates side-by-side and broke reading order).
        <div className="relative pl-7">
          <span aria-hidden className="absolute left-[6px] top-2 bottom-2 w-px bg-border" />
          <div className="flex flex-col gap-7">
            {grouped.map(({ date, entries: dayEntries }) => {
              const scoreDay = scoreMap[format(date, 'yyyy-MM-dd')]
              const wearable = dayEntries.find((e) => e.entryType === 'wearable')
              const labs = dayEntries.filter((e) => e.entryType === 'lab')
              const records = dayEntries.filter((e) => e.entryType === 'clinical')
              const events = dayEntries.filter(
                (e) => !['wearable', 'lab', 'clinical'].includes(e.entryType)
              )
              return (
                <section key={date.toISOString()} className="relative flex flex-col gap-2.5">
                  {/* Day node on the spine */}
                  <span
                    aria-hidden
                    className={cn(
                      'absolute -left-7 top-1 h-3.5 w-3.5 rounded-full border-2 bg-background',
                      scoreDay?.isFlareDay ? 'border-rose-400 shadow-[0_0_8px_1px_oklch(0.7_0.18_15/50%)]' : 'border-primary'
                    )}
                  />
                  <div className="flex items-center justify-between gap-2">
                    <p className="label-mono text-foreground">{dayLabel(date)}</p>
                    {scoreDay && <ScorePill score={scoreDay.score} isFlareDay={scoreDay.isFlareDay} />}
                  </div>

                  {wearable && <RecoveryStrip d={(wearable.data ?? {}) as Data} />}

                  {events.map((entry) => {
                    const meta = ENTRY_META[entry.entryType] ?? {
                      label: entry.entryType, icon: Circle, color: 'text-muted-foreground', accent: 'border-l-border',
                    }
                    const Icon = meta.icon
                    return (
                      <div
                        key={entry.id}
                        className={cn('rounded-lg border border-border border-l-2 bg-card p-3', meta.accent)}
                      >
                        <div className="flex items-center justify-between gap-2 mb-1.5">
                          <div className="flex items-center gap-1.5">
                            <Icon className={cn('h-3.5 w-3.5', meta.color)} strokeWidth={2.4} />
                            <span className={cn('text-[11px] font-semibold uppercase tracking-wide', meta.color)}>
                              {meta.label}
                            </span>
                            {entry.source !== 'manual' && entry.source !== 'voice' && (
                              <span className="text-[10px] text-muted-foreground/60 capitalize">
                                · {entry.source.replace('_', ' ')}
                              </span>
                            )}
                          </div>
                          <span className="text-[11px] text-muted-foreground tabular-nums">
                            {format(new Date(entry.loggedAt), 'h:mm a')}
                          </span>
                        </div>
                        <EntryBody entry={entry} phase={phase} />
                      </div>
                    )
                  })}

                  {labs.length > 0 && <LabGroupCard entries={labs} />}
                  {records.length > 0 && <RecordGroupCard entries={records} />}
                </section>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Grouped record cards (collapse synced labs/clinical into one tidy card) ───

function LabGroupCard({ entries }: { entries: LogEntry[] }) {
  const rows = entries
    .map((e) => {
      const d = (e.data ?? {}) as Data
      return { d, flag: flagLab(d), name: String(d.lab_name ?? 'Lab') }
    })
    // Abnormal (in-panel) first, then everything else.
    .sort((a, b) => Number(b.flag.concerning) - Number(a.flag.concerning))

  const CAP = 6
  const shown = rows.slice(0, CAP)
  const extra = rows.length - shown.length

  return (
    <div className="rounded-lg border border-border border-l-2 border-l-violet-400/70 bg-card p-3">
      <div className="flex items-center gap-1.5 mb-2">
        <FlaskConical className="h-3.5 w-3.5 text-violet-400" strokeWidth={2.4} />
        <span className="text-[11px] font-semibold uppercase tracking-wide text-violet-400">Labs</span>
        <span className="text-[10px] text-muted-foreground/70">· {rows.length} {rows.length === 1 ? 'result' : 'results'} · from records</span>
      </div>
      <div className="flex flex-col divide-y divide-border/60">
        {shown.map(({ d, flag, name }, i) => (
          <div key={i} className="flex items-center justify-between gap-2 py-1.5 first:pt-0 last:pb-0">
            <span className="text-xs text-foreground truncate">{name}</span>
            <span className="flex items-center gap-1.5 shrink-0">
              <span className="text-xs font-medium text-foreground tabular-nums">
                {String(d.value ?? '?')}{d.unit ? <span className="text-muted-foreground font-normal"> {String(d.unit)}</span> : null}
              </span>
              {flag.status && flag.status !== 'normal' && (
                <span
                  className={cn(
                    'inline-flex items-center gap-0.5 rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase',
                    flag.concerning ? 'bg-orange-500/15 text-orange-400' : 'bg-muted text-muted-foreground'
                  )}
                >
                  {flag.status === 'high' ? <ArrowUp className="h-2.5 w-2.5" /> : <ArrowDown className="h-2.5 w-2.5" />}
                  {flag.status}
                </span>
              )}
            </span>
          </div>
        ))}
      </div>
      {extra > 0 && <p className="mt-2 text-[11px] text-muted-foreground/70">+{extra} more {extra === 1 ? 'result' : 'results'}</p>}
    </div>
  )
}

const RECORD_KIND_LABEL: Record<string, string> = {
  condition: 'Condition', encounter: 'Visit', procedure: 'Procedure',
  allergy: 'Allergy', immunization: 'Immunization', document: 'Document',
}

function RecordGroupCard({ entries }: { entries: LogEntry[] }) {
  const rows = entries
    .map((e) => {
      const d = (e.data ?? {}) as Data
      return { kind: String(d.kind ?? 'record'), text: String(d.text ?? 'Record') }
    })
    .filter((r) => r.text && r.text !== 'Not on File')

  if (rows.length === 0) return null

  return (
    <div className="rounded-lg border border-border border-l-2 border-l-violet-400/70 bg-card p-3">
      <div className="flex items-center gap-1.5 mb-2">
        <Stethoscope className="h-3.5 w-3.5 text-violet-400" strokeWidth={2.4} />
        <span className="text-[11px] font-semibold uppercase tracking-wide text-violet-400">Records</span>
        <span className="text-[10px] text-muted-foreground/70">· from records</span>
      </div>
      <div className="flex flex-col gap-1.5">
        {rows.map((r, i) => (
          <div key={i} className="flex items-center gap-2">
            <span className="shrink-0 rounded bg-muted/60 px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
              {RECORD_KIND_LABEL[r.kind] ?? r.kind}
            </span>
            <span className="text-xs text-foreground">{r.text}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Per-type bodies ──────────────────────────────────────────────────────────

function EntryBody({ entry, phase }: { entry: LogEntry; phase: AidPhase }) {
  const d = (entry.data ?? {}) as Data
  switch (entry.entryType) {
    case 'meal': return <MealBody d={d} phase={phase} />
    case 'wearable': return <WearableBody d={d} />
    case 'symptom': return <SymptomBody d={d} />
    case 'bowel_movement': return <BowelBody d={d} />
    case 'medication': return <MedBody d={d} />
    case 'sleep': return <Stats stats={[st(Moon, 'Sleep', n(d.duration_hours, 'h')), st(Heart, 'Quality', n(d.quality, '/10'))]} />
    case 'exercise': return <ExerciseBody d={d} />
    case 'weight': return <WeightBody d={d} />
    case 'lab':
    case 'clinical': return <p className="text-sm text-foreground">{String(d.lab_name ?? d.text ?? 'Record')}{d.value != null ? `: ${d.value}${d.unit ? ' ' + d.unit : ''}` : ''}</p>
    default: return <p className="text-sm text-muted-foreground">{String(d.summary ?? d.description ?? 'Entry')}</p>
  }
}

function MealBody({ d, phase }: { d: Data; phase: AidPhase }) {
  const tags = Array.isArray(d.tags) ? d.tags.map(String) : []
  const foodClass = typeof d.food_class === 'string' ? (d.food_class as FoodClass) : undefined
  const verdict = (foodClass || tags.length) ? evaluateMealForPhase(foodClass, tags, phase) : null

  const macros = [
    d.calories != null ? `${Math.round(Number(d.calories))} kcal` : null,
    d.protein_g != null ? `P ${d.protein_g}g` : null,
    d.carbs_g != null ? `C ${d.carbs_g}g` : null,
    d.fat_g != null ? `F ${d.fat_g}g` : null,
    d.fiber_g != null ? `Fiber ${d.fiber_g}g` : null,
  ].filter(Boolean).join(' · ')

  return (
    <div>
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-medium text-foreground">{String(d.description ?? 'Meal')}</p>
        {verdict && <VerdictBadge v={verdict} />}
      </div>
      {macros && <p className="text-xs text-muted-foreground mt-0.5">{macros}</p>}
      {tags.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-2">
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
      {verdict?.note && <p className="text-[11px] text-muted-foreground/80 mt-1.5 leading-relaxed">{verdict.note}</p>}
    </div>
  )
}

function VerdictBadge({ v }: { v: ReturnType<typeof evaluateMealForPhase> }) {
  const TONE: Record<string, string> = {
    emerald: 'bg-emerald-500/10 text-emerald-400',
    yellow: 'bg-yellow-500/10 text-yellow-400',
    orange: 'bg-orange-500/10 text-orange-400',
    muted: 'bg-muted text-muted-foreground',
  }
  const Icon = v.kind === 'good' ? Check : v.kind === 'ok' ? null : AlertTriangle
  return (
    <span className={cn('shrink-0 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold', TONE[v.tone])}>
      {Icon && <Icon className="h-3 w-3" strokeWidth={2.6} />}
      {v.label}
    </span>
  )
}

function WearableBody({ d }: { d: Data }) {
  const stats = [
    d.sleep_hours != null ? st(Moon, 'Sleep', `${d.sleep_hours}h`) : null,
    d.resting_hr != null ? st(Heart, 'RHR', `${d.resting_hr}`) : null,
    d.hrv != null ? st(Activity, 'HRV', `${d.hrv}`) : null,
    d.respiratory_rate != null ? st(Wind, 'Resp', `${d.respiratory_rate}`) : null,
    d.steps != null ? st(Footprints, 'Steps', Number(d.steps).toLocaleString()) : null,
  ].filter(Boolean) as StatItem[]
  if (stats.length === 0) return <p className="text-sm text-muted-foreground">No wearable metrics</p>
  return <Stats stats={stats} />
}

function SymptomBody({ d }: { d: Data }) {
  const items: [string, number][] = ([
    ['Pain', d.pain_scale], ['Fatigue', d.fatigue], ['Bloating', d.bloating], ['Nausea', d.nausea],
  ] as [string, unknown][]).filter(([, v]) => v != null).map(([l, v]) => [l, Number(v)])
  return (
    <div>
      <div className="flex flex-wrap gap-1.5">
        {items.map(([label, v]) => (
          <span key={label} className={cn('rounded-md px-2 py-0.5 text-[11px] font-medium tabular-nums', sevTone(v))}>
            {label} {v}/10
          </span>
        ))}
      </div>
      {typeof d.notes === 'string' && d.notes && (
        <p className="text-xs text-muted-foreground mt-1.5 italic">“{d.notes}”</p>
      )}
    </div>
  )
}

function BowelBody({ d }: { d: Data }) {
  return (
    <div className="flex flex-wrap gap-1.5 text-[11px]">
      <Pill2>{`${d.count ?? '?'} movements`}</Pill2>
      {d.consistency != null && <Pill2>{String(d.consistency)}</Pill2>}
      {d.urgency != null && <span className={cn('rounded-md px-2 py-0.5 font-medium tabular-nums', sevTone(Number(d.urgency)))}>Urgency {String(d.urgency)}/10</span>}
      {d.blood ? <span className="rounded-md px-2 py-0.5 font-semibold bg-red-500/15 text-red-400">Blood</span> : null}
    </div>
  )
}

function MedBody({ d }: { d: Data }) {
  const taken = d.taken !== false
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-sm text-foreground">{String(d.med_name ?? 'Medication')}{d.dose ? ` · ${d.dose}` : ''}</span>
      <span className={cn('rounded-full px-2 py-0.5 text-[10px] font-semibold', taken ? 'bg-emerald-500/10 text-emerald-400' : 'bg-orange-500/10 text-orange-400')}>
        {taken ? 'Taken' : 'Missed'}
      </span>
    </div>
  )
}

function ExerciseBody({ d }: { d: Data }) {
  return (
    <div className="flex flex-wrap gap-1.5 text-[11px]">
      <Pill2 className="capitalize">{String(d.type ?? 'Exercise')}{d.focus ? ` · ${d.focus}` : ''}</Pill2>
      {d.duration_minutes != null && <Pill2>{`${d.duration_minutes} min`}</Pill2>}
      {d.intensity != null && <Pill2 className="capitalize">{String(d.intensity)}</Pill2>}
      {d.rpe != null && <Pill2>RPE {String(d.rpe)}</Pill2>}
      {d.post_workout_fatigue != null && <span className={cn('rounded-md px-2 py-0.5 font-medium tabular-nums', sevTone(Number(d.post_workout_fatigue)))}>Post-fatigue {String(d.post_workout_fatigue)}/10</span>}
      {d.steps != null && <Pill2>{`${Number(d.steps).toLocaleString()} steps`}</Pill2>}
    </div>
  )
}

function WeightBody({ d }: { d: Data }) {
  const stats = [
    d.weight_kg != null ? st(Scale, d.is_trend ? 'Trend' : 'Weight', `${d.weight_kg} kg`) : null,
    d.fat_percent != null ? st(Activity, 'Body fat', `${d.fat_percent}%`) : null,
    d.steps != null ? st(Footprints, 'Steps', Number(d.steps).toLocaleString()) : null,
  ].filter(Boolean) as StatItem[]
  if (stats.length === 0) return <p className="text-sm text-muted-foreground">Body metrics</p>
  return <Stats stats={stats} />
}

// ─── Small shared bits ──────────────────────────────────────────────────────

interface StatItem { icon: React.ElementType; label: string; val: string }
function st(icon: React.ElementType, label: string, val: string): StatItem { return { icon, label, val } }
function n(v: unknown, suffix: string): string { return v == null ? '—' : `${v}${suffix}` }

function Stats({ stats }: { stats: StatItem[] }) {
  return (
    <div className="flex flex-wrap gap-2">
      {stats.map((s) => {
        const Icon = s.icon
        return (
          <span key={s.label} className="inline-flex items-center gap-1.5 rounded-md bg-muted/60 px-2 py-1 text-xs">
            <Icon className="h-3 w-3 text-muted-foreground" />
            <span className="text-muted-foreground">{s.label}</span>
            <span className="font-semibold text-foreground tabular-nums">{s.val}</span>
          </span>
        )
      })}
    </div>
  )
}

function Pill2({ children, className }: { children: React.ReactNode; className?: string }) {
  return <span className={cn('rounded-md bg-muted/60 px-2 py-0.5 text-foreground', className)}>{children}</span>
}

function sevTone(v: number): string {
  if (v >= 6) return 'bg-red-500/10 text-red-400'
  if (v >= 4) return 'bg-orange-500/10 text-orange-400'
  if (v >= 1) return 'bg-yellow-500/10 text-yellow-400'
  return 'bg-muted text-muted-foreground'
}

// Wearable day → one slim ambient line (it's context, not a logged event).
function RecoveryStrip({ d }: { d: Data }) {
  const parts = [
    d.sleep_hours != null ? `Sleep ${d.sleep_hours}h` : null,
    d.resting_hr != null ? `RHR ${d.resting_hr}` : null,
    d.hrv != null ? `HRV ${d.hrv}` : null,
    d.respiratory_rate != null ? `Resp ${d.respiratory_rate}` : null,
    d.steps != null ? `${Number(d.steps).toLocaleString()} steps` : null,
  ].filter(Boolean)
  if (parts.length === 0) return null
  return (
    <div className="flex items-center gap-1.5 rounded-md border border-border/60 bg-card/50 px-2.5 py-1 text-[11px] text-muted-foreground">
      <HeartPulse className="h-3 w-3 shrink-0 text-cyan-400" />
      <span className="truncate">{parts.join('  ·  ')}</span>
    </div>
  )
}

function ScorePill({ score }: { score: number; isFlareDay: boolean }) {
  const { label, color, bgColor } = getScoreLabel(score)
  return (
    <div className={cn('flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-semibold', bgColor, color)}>
      <Activity className="h-2.5 w-2.5" strokeWidth={2.5} />
      {Math.round(score)} · {label}
    </div>
  )
}
