'use client'

import { useMemo, useState } from 'react'
import { format, isToday, isYesterday, parseISO, isSameDay } from 'date-fns'
import type { LogEntry } from '@/lib/db/schema'
import { cn } from '@/lib/utils'
import { Droplets, Heart, Utensils, Pill, Moon, Dumbbell, Activity, Circle, Scale } from 'lucide-react'
import { getScoreLabel } from '@/lib/stability-score'

const ENTRY_META: Record<string, { label: string; icon: React.ElementType; color: string; dot: string }> = {
  bowel_movement: { label: 'BM',       icon: Droplets,  color: 'text-blue-400',    dot: 'bg-blue-400' },
  symptom:        { label: 'Symptom',  icon: Heart,     color: 'text-pink-400',    dot: 'bg-pink-400' },
  meal:           { label: 'Meal',     icon: Utensils,  color: 'text-teal-400',    dot: 'bg-teal-400' },
  medication:     { label: 'Med',      icon: Pill,      color: 'text-purple-400',  dot: 'bg-purple-400' },
  sleep:          { label: 'Sleep',    icon: Moon,      color: 'text-indigo-400',  dot: 'bg-indigo-400' },
  exercise:       { label: 'Exercise', icon: Dumbbell,  color: 'text-emerald-400', dot: 'bg-emerald-400' },
  weight:         { label: 'Weight',   icon: Scale,     color: 'text-amber-400',   dot: 'bg-amber-400' },
}

interface ScoreDay {
  date: string
  score: number
  isFlareDay: boolean
}

interface TimelineViewProps {
  entries: LogEntry[]
  scoreHistory: ScoreDay[]
}

type FilterType = 'all' | 'bowel_movement' | 'symptom' | 'meal' | 'medication' | 'sleep' | 'exercise' | 'weight'

function entryOneLiner(entry: LogEntry): string {
  const d = entry.data as Record<string, unknown>
  switch (entry.entryType) {
    case 'bowel_movement':
      return `${d.count ?? '?'} BM · Urgency ${d.urgency ?? '?'}/10${d.blood ? ' · Blood' : ''}`
    case 'symptom':
      return `Pain ${d.pain_scale ?? '?'} · Fatigue ${d.fatigue ?? '?'}${d.notes ? ` · "${String(d.notes).slice(0, 40)}"` : ''}`
    case 'meal': {
      const macros = [
        d.protein_g !== undefined ? `P${d.protein_g}` : null,
        d.carbs_g !== undefined ? `C${d.carbs_g}` : null,
        d.fat_g !== undefined ? `F${d.fat_g}` : null,
      ].filter(Boolean).join(' / ')
      return `${d.description ?? 'Meal'} · ${d.calories ?? '?'} kcal${macros ? ` · ${macros}` : ''}${d.trigger_foods ? ' · Trigger' : ''}`
    }
    case 'medication':
      return `${d.med_name ?? 'Med'} ${d.taken === false ? '(missed)' : '(taken)'}`
    case 'sleep':
      return `${d.duration_hours ?? '?'}h · Quality ${d.quality ?? '?'}/10`
    case 'exercise':
      return `${d.type ?? 'Exercise'} ${d.duration_minutes ?? '?'} min · ${Number(d.steps ?? 0).toLocaleString()} steps`
    case 'weight':
      return `${d.weight_kg ?? '?'} kg${d.is_trend ? ' (trend)' : ''}${d.steps !== undefined ? ` · ${Number(d.steps).toLocaleString()} steps` : ''}`
    default:
      return JSON.stringify(d).slice(0, 60)
  }
}

function dayLabel(date: Date): string {
  if (isToday(date)) return 'Today'
  if (isYesterday(date)) return 'Yesterday'
  return format(date, 'EEEE, MMM d')
}

function groupByDay(entries: LogEntry[]) {
  const groups: { date: Date; entries: LogEntry[] }[] = []
  for (const entry of entries) {
    const d = new Date(entry.loggedAt)
    const existing = groups.find(g => isSameDay(g.date, d))
    if (existing) {
      existing.entries.push(entry)
    } else {
      groups.push({ date: d, entries: [entry] })
    }
  }
  return groups.sort((a, b) => b.date.getTime() - a.date.getTime())
}

export function TimelineView({ entries, scoreHistory }: TimelineViewProps) {
  const [filter, setFilter] = useState<FilterType>('all')

  const filtered = useMemo(() => {
    if (filter === 'all') return entries
    return entries.filter(e => e.entryType === filter)
  }, [entries, filter])

  const grouped = useMemo(() => groupByDay(filtered), [filtered])

  const scoreMap = useMemo(() => {
    const m: Record<string, ScoreDay> = {}
    for (const s of scoreHistory) m[s.date] = s
    return m
  }, [scoreHistory])

  const filterOptions: { value: FilterType; label: string }[] = [
    { value: 'all', label: 'All' },
    { value: 'bowel_movement', label: 'BM' },
    { value: 'symptom', label: 'Symptoms' },
    { value: 'meal', label: 'Meals' },
    { value: 'medication', label: 'Meds' },
    { value: 'sleep', label: 'Sleep' },
    { value: 'exercise', label: 'Exercise' },
    { value: 'weight', label: 'Weight' },
  ]

  return (
    <div className="flex flex-col gap-4">
      {/* Filter chips */}
      <div className="flex gap-1.5 overflow-x-auto pb-1 -mx-4 px-4 scrollbar-hide">
        {filterOptions.map(opt => (
          <button
            key={opt.value}
            onClick={() => setFilter(opt.value)}
            className={cn(
              'flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-medium border transition-colors',
              filter === opt.value
                ? 'bg-primary/20 border-primary/50 text-primary'
                : 'bg-card border-border text-muted-foreground hover:text-foreground'
            )}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {/* Grouped timeline */}
      {grouped.length === 0 ? (
        <div className="rounded-xl border border-border bg-card p-8 text-center">
          <p className="text-sm text-muted-foreground">No entries found</p>
        </div>
      ) : (
        grouped.map(({ date, entries: dayEntries }) => {
          const dateStr = format(date, 'yyyy-MM-dd')
          const scoreDay = scoreMap[dateStr]

          return (
            <div key={dateStr}>
              {/* Day header */}
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  {dayLabel(date)}
                </p>
                {scoreDay && (
                  <ScorePill score={scoreDay.score} isFlareDay={scoreDay.isFlareDay} />
                )}
              </div>

              {/* Entries */}
              <div className="flex flex-col gap-0.5">
                {dayEntries.map((entry, i) => {
                  const meta = ENTRY_META[entry.entryType] ?? { label: entry.entryType, icon: Circle, color: 'text-muted-foreground', dot: 'bg-muted-foreground' }
                  const Icon = meta.icon
                  const isLast = i === dayEntries.length - 1

                  return (
                    <div key={entry.id} className="flex gap-3">
                      {/* Timeline spine */}
                      <div className="flex flex-col items-center w-5 flex-shrink-0">
                        <div className={cn('h-2.5 w-2.5 rounded-full mt-3 flex-shrink-0', meta.dot)} />
                        {!isLast && <div className="w-px flex-1 bg-border mt-1 min-h-[20px]" />}
                      </div>
                      {/* Content */}
                      <div className="flex-1 rounded-lg border border-border bg-card p-3 mb-1">
                        <div className="flex items-center justify-between gap-2 mb-0.5">
                          <div className="flex items-center gap-1.5">
                            <Icon className={cn('h-3 w-3', meta.color)} strokeWidth={2.5} />
                            <span className={cn('text-xs font-semibold uppercase tracking-wide', meta.color)}>
                              {meta.label}
                            </span>
                          </div>
                          <span className="text-xs text-muted-foreground">
                            {format(new Date(entry.loggedAt), 'h:mm a')}
                          </span>
                        </div>
                        <p className="text-sm text-foreground leading-relaxed">
                          {entryOneLiner(entry)}
                        </p>
                        {entry.source !== 'manual' && (
                          <span className="text-xs text-muted-foreground/60 mt-0.5 block capitalize">
                            via {entry.source.replace('_', ' ')}
                          </span>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )
        })
      )}
    </div>
  )
}

function ScorePill({ score, isFlareDay }: { score: number; isFlareDay: boolean }) {
  const { label, color, bgColor } = getScoreLabel(score)
  return (
    <div className={cn('flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-semibold', bgColor, color)}>
      <Activity className="h-2.5 w-2.5" strokeWidth={2.5} />
      {Math.round(score)} · {label}
    </div>
  )
}
