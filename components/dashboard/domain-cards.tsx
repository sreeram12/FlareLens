'use client'

import { useState } from 'react'
import { getDomainLabel, type DomainScores } from '@/lib/stability-score'
import { cn } from '@/lib/utils'
import { HeartPulse, Utensils, Pill, Dumbbell, FlaskConical, Activity, ChevronRight, Sparkles } from 'lucide-react'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet'

const DOMAIN_ICONS: Record<string, React.ElementType> = {
  symptoms: Activity,
  inflammation: FlaskConical,
  recovery: HeartPulse,
  medications: Pill,
  nutrition: Utensils,
  activity: Dumbbell,
}

// `passive` = captured automatically (records / wearables), not daily self-report.
const DOMAIN_INFO: Record<string, { weight: string; passive: boolean; description: string; measures: string[] }> = {
  symptoms: {
    weight: '22%',
    passive: false,
    description:
      'Your reported symptoms. Abdominal pain and stool frequency are the patient-reported clinical-remission targets in IBD (STRIDE-II).',
    measures: ['Abdominal pain', 'Stool frequency vs. baseline', 'Urgency', 'Bloating', 'Blood in stool', 'Nausea'],
  },
  inflammation: {
    weight: '20%',
    passive: true,
    description:
      'Objective biomarkers of gut inflammation — the treat-to-target markers your GI follows (STRIDE-II). Pulled automatically from your medical records.',
    measures: ['Fecal calprotectin', 'CRP (C-reactive protein)', 'Fever'],
  },
  recovery: {
    weight: '20%',
    passive: true,
    description:
      'Wearable physiology and sleep. Resting heart rate, HRV and activity can shift up to ~7 weeks before a flare (Mount Sinai IBD Forecast study, 2025).',
    measures: ['Resting heart rate', 'Heart-rate variability (HRV)', 'Sleep vs. baseline', 'Respiratory rate', 'Fatigue'],
  },
  medications: {
    weight: '15%',
    passive: false,
    description: 'Adherence to your prescribed treatment plan — the foundation of staying in remission.',
    measures: ['Doses taken on schedule', 'Missed or skipped doses'],
  },
  nutrition: {
    weight: '13%',
    passive: false,
    description:
      'How closely your food follows an anti-inflammatory (IBD-AID) pattern that helps calm gut inflammation.',
    measures: ['Anti-inflammatory foods (omega-3, probiotics, soluble fiber)', 'Pro-inflammatory foods (refined sugar, fried & processed)', 'Known trigger foods', 'Adequate intake during flares'],
  },
  activity: {
    weight: '10%',
    passive: true,
    description: 'Daily movement. Step counts drop during flares, and regular moderate activity supports remission.',
    measures: ['Steps vs. baseline', 'Active minutes'],
  },
}

interface LogEntry {
  id: number
  entryType: string
  data: unknown
  loggedAt: Date | string
  rawTranscript?: string | null
  source?: string | null
}

interface DomainCardsProps {
  domainScores: Record<string, number>
  entries?: LogEntry[]
  reasons?: string[]
}

function getDomainColor(score: number, maxScore: number) {
  const pct = maxScore > 0 ? score / maxScore : 0
  if (pct < 0.25) return { text: 'text-emerald-400', bar: 'bg-emerald-400', bg: 'bg-emerald-500/8', label: 'Stable' }
  if (pct < 0.5)  return { text: 'text-yellow-400',  bar: 'bg-yellow-400',  bg: 'bg-yellow-500/8', label: 'Mild' }
  if (pct < 0.75) return { text: 'text-orange-400',  bar: 'bg-orange-400',  bg: 'bg-orange-500/8', label: 'Elevated' }
  return                { text: 'text-red-400',     bar: 'bg-red-400',     bg: 'bg-red-500/8', label: 'High' }
}

function isRelevant(domain: string, entry: LogEntry): boolean {
  const t = entry.entryType
  const d = (entry.data ?? {}) as Record<string, unknown>
  switch (domain) {
    case 'symptoms': return t === 'bowel_movement' || (t === 'symptom' && (d.pain_scale != null || d.bloating != null || d.nausea != null))
    case 'inflammation': return t === 'lab' || d.temperature != null
    case 'recovery': return t === 'wearable' || t === 'sleep' || (t === 'symptom' && d.fatigue != null)
    case 'activity': return t === 'exercise' || ((t === 'weight' || t === 'wearable') && d.steps != null)
    case 'nutrition': return t === 'meal'
    case 'medications': return t === 'medication'
    default: return false
  }
}

function summarizeEntry(domain: string, entry: LogEntry): string {
  const d = (entry.data ?? {}) as Record<string, unknown>
  const t = entry.entryType
  const parts: string[] = []

  if (t === 'bowel_movement') {
    const count = Number(d.count ?? 1)
    parts.push(`${count} bowel movement${count !== 1 ? 's' : ''}`)
    if (d.urgency != null) parts.push(`urgency ${Number(d.urgency)}/10`)
    if (Number(d.pain_before) > 0) parts.push(`pain ${Number(d.pain_before)}/10`)
    if (d.blood) parts.push('blood present')
  } else if (t === 'symptom') {
    if (domain === 'symptoms') {
      if (d.pain_scale != null) parts.push(`pain ${Number(d.pain_scale)}/10`)
      if (d.bloating != null) parts.push(`bloating ${Number(d.bloating)}/10`)
      if (d.nausea != null) parts.push(`nausea ${Number(d.nausea)}/10`)
    }
    if (domain === 'recovery' && d.fatigue != null) parts.push(`fatigue ${Number(d.fatigue)}/10`)
  } else if (t === 'sleep') {
    if (d.duration_hours != null) parts.push(`${Number(d.duration_hours).toFixed(1)}h sleep`)
    if (d.quality != null) parts.push(`quality ${Number(d.quality)}/10`)
  } else if (t === 'wearable') {
    if (d.sleep_hours != null) parts.push(`${Number(d.sleep_hours).toFixed(1)}h sleep`)
    if (d.resting_hr != null) parts.push(`RHR ${Number(d.resting_hr)}`)
    if (d.hrv != null) parts.push(`HRV ${Number(d.hrv)}`)
    if (d.respiratory_rate != null) parts.push(`resp ${Number(d.respiratory_rate)}`)
    if (domain === 'activity' && d.steps != null) parts.push(`${Number(d.steps).toLocaleString()} steps`)
  } else if (t === 'meal') {
    const desc = (d.description as string) || (d.food as string) || (d.name as string)
    if (desc && desc !== 'Daily nutrition (MacroFactor)') parts.push(desc)
    if (d.calories != null) parts.push(`${Number(d.calories).toLocaleString()} kcal`)
    if (d.protein_g != null) parts.push(`${Number(d.protein_g)}g protein`)
    if (d.trigger_foods) parts.push('trigger foods')
  } else if (t === 'medication') {
    const name = (d.med_name as string) || (d.name as string) || 'Medication'
    parts.push(`${name} — ${d.taken === false ? 'missed' : 'taken'}`)
  } else if (t === 'exercise') {
    if (d.steps != null) parts.push(`${Number(d.steps).toLocaleString()} steps`)
    if (d.duration_minutes != null) parts.push(`${Number(d.duration_minutes)} min active`)
  } else if (t === 'weight') {
    if (d.steps != null) parts.push(`${Number(d.steps).toLocaleString()} steps`)
  } else if (t === 'lab') {
    if (d.crp != null) parts.push(`CRP ${Number(d.crp)} mg/L`)
    if (d.calprotectin != null) parts.push(`calprotectin ${Number(d.calprotectin)} ug/g`)
    if (d.wbc != null) parts.push(`WBC ${Number(d.wbc)} K/uL`)
  }

  if (d.temperature != null && domain === 'inflammation') parts.push(`${Number(d.temperature).toFixed(1)}°C`)

  return parts.join(' · ') || t.replace(/_/g, ' ')
}

const REASON_KEYWORDS: Record<string, RegExp> = {
  symptoms: /\bBMs?\b|blood|urgency|pain|bloat|nausea|stool/i,
  inflammation: /CRP|calprotectin|fever/i,
  recovery: /sleep|fatigue|resting heart|HRV|heart rate/i,
  activity: /activity|steps/i,
  nutrition: /trigger food|caloric|kcal|calorie|inflammatory|anti-inflammatory/i,
  medications: /medication|dose/i,
}

function formatTime(value: Date | string): string {
  const d = new Date(value)
  return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
}

export function DomainCards({ domainScores, entries = [], reasons = [] }: DomainCardsProps) {
  const domains = (['symptoms', 'inflammation', 'recovery', 'medications', 'nutrition', 'activity'] as const)
  const [open, setOpen] = useState<keyof DomainScores | null>(null)

  const active = open
  const activeMeta = active ? getDomainLabel(active) : null
  const activeScore = active ? (domainScores[active] ?? 0) : 0
  const activeColor = activeMeta ? getDomainColor(activeScore, activeMeta.maxScore) : null
  const ActiveIcon = active ? (DOMAIN_ICONS[active] ?? Activity) : Activity
  const activeEntries = active ? entries.filter(e => isRelevant(active, e)) : []
  const activeReasons = active ? reasons.filter(r => REASON_KEYWORDS[active]?.test(r)) : []
  const activeInfo = active ? DOMAIN_INFO[active] : null

  return (
    <div>
      <p className="text-xs font-medium text-muted-foreground tracking-wide uppercase mb-2">
        Domains
      </p>
      <div className="grid grid-cols-2 gap-2">
        {domains.map(key => {
          const meta = getDomainLabel(key)
          const score = domainScores[key] ?? 0
          const { text, bar, bg } = getDomainColor(score, meta.maxScore)
          const pct = meta.maxScore > 0 ? Math.min((score / meta.maxScore) * 100, 100) : 0
          const Icon = DOMAIN_ICONS[key] ?? Activity
          const passive = DOMAIN_INFO[key]?.passive

          return (
            <button
              key={key}
              type="button"
              onClick={() => setOpen(key)}
              aria-label={`View ${meta.name} details`}
              className={cn(
                'group rounded-lg border border-border p-3 bg-card flex flex-col gap-2 text-left',
                'transition-colors hover:border-foreground/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                bg
              )}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 min-w-0">
                  <Icon className={cn('h-3.5 w-3.5 shrink-0', text)} strokeWidth={2} />
                  <span className="text-xs font-medium text-foreground leading-none truncate">{meta.name}</span>
                </div>
                <span className={cn('text-xs font-bold tabular-nums shrink-0', text)}>
                  {score.toFixed(0)}<span className="text-muted-foreground font-normal">/{meta.maxScore}</span>
                </span>
              </div>
              {/* Progress bar */}
              <div className="h-1 rounded-full bg-border overflow-hidden">
                <div
                  className={cn('h-full rounded-full transition-all duration-500', bar)}
                  style={{ width: `${pct}%` }}
                />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-muted-foreground">
                  {passive ? 'Auto-tracked' : 'Tap for details'}
                </span>
                <ChevronRight className="h-3 w-3 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
              </div>
            </button>
          )
        })}
      </div>

      <Sheet open={active !== null} onOpenChange={(o) => !o && setOpen(null)}>
        <SheetContent side="bottom" className="max-h-[85vh] overflow-y-auto rounded-t-2xl">
          {active && activeMeta && activeColor && activeInfo && (
            <>
              <SheetHeader className="text-left">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    <div className={cn('flex h-10 w-10 items-center justify-center rounded-full', activeColor.bg)}>
                      <ActiveIcon className={cn('h-5 w-5', activeColor.text)} strokeWidth={2} />
                    </div>
                    <div>
                      <SheetTitle className="text-base">{activeMeta.name}</SheetTitle>
                      <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        Weighted {activeInfo.weight} of your score
                        {activeInfo.passive && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary">
                            <Sparkles className="h-2.5 w-2.5" /> Auto-tracked
                          </span>
                        )}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className={cn('text-2xl font-bold tabular-nums leading-none', activeColor.text)}>
                      {activeScore.toFixed(0)}
                      <span className="text-sm font-normal text-muted-foreground">/{activeMeta.maxScore}</span>
                    </div>
                    <span className={cn('text-[10px] font-medium', activeColor.text)}>{activeColor.label}</span>
                  </div>
                </div>
                <SheetDescription className="text-sm text-pretty pt-1">
                  {activeInfo.description}
                </SheetDescription>
              </SheetHeader>

              <div className="flex flex-col gap-5 px-4 pb-6 pt-2">
                {/* Contributing factors */}
                {activeReasons.length > 0 && (
                  <section>
                    <h3 className="text-xs font-medium text-muted-foreground tracking-wide uppercase mb-2">
                      Why this is elevated
                    </h3>
                    <ul className="flex flex-col gap-1.5">
                      {activeReasons.map((r, i) => (
                        <li key={i} className={cn('flex items-start gap-2 text-sm rounded-md px-2.5 py-2', activeColor.bg)}>
                          <span className={cn('mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full', activeColor.bar)} />
                          <span className="text-foreground">{r}</span>
                        </li>
                      ))}
                    </ul>
                  </section>
                )}

                {/* Today's entries */}
                <section>
                  <h3 className="text-xs font-medium text-muted-foreground tracking-wide uppercase mb-2">
                    {`Today’s entries`}
                  </h3>
                  {activeEntries.length > 0 ? (
                    <ul className="flex flex-col gap-1.5">
                      {activeEntries.map((e) => (
                        <li
                          key={e.id}
                          className="flex items-center justify-between gap-3 rounded-md border border-border bg-card px-3 py-2.5"
                        >
                          <span className="text-sm text-foreground">{summarizeEntry(active, e)}</span>
                          <span className="text-xs text-muted-foreground tabular-nums shrink-0">
                            {formatTime(e.loggedAt)}
                          </span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="rounded-md border border-dashed border-border px-3 py-4 text-sm text-muted-foreground text-center">
                      No {activeMeta.name.toLowerCase()} entries logged today.
                    </p>
                  )}
                </section>

                {/* What we measure */}
                <section>
                  <h3 className="text-xs font-medium text-muted-foreground tracking-wide uppercase mb-2">
                    What this tracks
                  </h3>
                  <ul className="flex flex-col gap-1.5">
                    {activeInfo.measures.map((m, i) => (
                      <li key={i} className="flex items-center gap-2 text-sm text-muted-foreground">
                        <span className="h-1 w-1 shrink-0 rounded-full bg-muted-foreground/50" />
                        {m}
                      </li>
                    ))}
                  </ul>
                </section>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  )
}
