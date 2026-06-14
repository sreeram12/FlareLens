'use client'

import { useEffect, useMemo, useState } from 'react'
import { format, subDays } from 'date-fns'
import { FileText, AlertTriangle, CheckCircle2, Pill, TrendingUp, TrendingDown, Minus, Salad, FlaskConical, ArrowUp, ArrowDown, Sparkles, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { LogEntry, Medication } from '@/lib/db/schema'
import { getScoreLabel } from '@/lib/stability-score'
import { analyzeNutrition } from '@/lib/nutrition-analysis'
import { type LabSummary } from '@/lib/labs'
import { buildGiQuestions } from '@/lib/report-questions'

interface ScoreDay {
  scoreDate: string | Date
  totalScore: unknown
  isFlareDayBoolean?: boolean | null
}

interface DoctorReportProps {
  entries: LogEntry[]
  scoreHistory: ScoreDay[]
  medications: Medication[]
  labs: LabSummary[]
}

function avg(arr: number[]) {
  if (!arr.length) return 0
  return arr.reduce((a, b) => a + b, 0) / arr.length
}

export function DoctorReport({ entries, scoreHistory, medications, labs }: DoctorReportProps) {
  const [period, setPeriod] = useState<7 | 14 | 30>(14)
  const cutoff = useMemo(() => subDays(new Date(), period), [period])

  const periodEntries = useMemo(() =>
    entries.filter(e => new Date(e.loggedAt) >= cutoff),
    [entries, cutoff]
  )

  const periodScores = useMemo(() =>
    scoreHistory
      .filter(s => new Date(s.scoreDate as string) >= cutoff)
      .map(s => ({ date: s.scoreDate as string, score: parseFloat(s.totalScore as string), isFlareDay: s.isFlareDayBoolean ?? false })),
    [scoreHistory, cutoff]
  )

  // IBD nutrient-gap analysis (uses imported MacroFactor micronutrient panel)
  const nutrition = useMemo(() => analyzeNutrition(periodEntries, period), [periodEntries, period])

  // Aggregate stats
  const bmEntries = periodEntries.filter(e => e.entryType === 'bowel_movement')
  const symptomEntries = periodEntries.filter(e => e.entryType === 'symptom')
  const sleepEntries = periodEntries.filter(e => e.entryType === 'sleep')
  const mealEntries = periodEntries.filter(e => e.entryType === 'meal')

  const avgBMPerDay = bmEntries.length > 0
    ? avg(bmEntries.map(e => Number((e.data as Record<string, unknown>).count ?? 1)))
    : 0

  const bloodDays = bmEntries.filter(e => (e.data as Record<string, unknown>).blood).length
  const avgPain = symptomEntries.length > 0
    ? avg(symptomEntries.map(e => Number((e.data as Record<string, unknown>).pain_scale ?? 0)))
    : 0
  const maxPain = symptomEntries.length > 0
    ? Math.max(...symptomEntries.map(e => Number((e.data as Record<string, unknown>).pain_scale ?? 0)))
    : 0
  const avgSleep = sleepEntries.length > 0
    ? avg(sleepEntries.map(e => Number((e.data as Record<string, unknown>).duration_hours ?? 0)))
    : 0
  const triggerMeals = mealEntries.filter(e => (e.data as Record<string, unknown>).trigger_foods).length
  const flareDays = periodScores.filter(s => s.isFlareDay).length
  const avgScore = periodScores.length > 0 ? avg(periodScores.map(s => s.score)) : 0

  const sortedScores = [...periodScores].sort((a, b) => a.date.localeCompare(b.date))
  const firstHalf = sortedScores.slice(0, Math.floor(sortedScores.length / 2))
  const secondHalf = sortedScores.slice(Math.floor(sortedScores.length / 2))
  const firstAvg = firstHalf.length ? avg(firstHalf.map(s => s.score)) : 0
  const secondAvg = secondHalf.length ? avg(secondHalf.map(s => s.score)) : 0
  const trend = secondAvg > firstAvg + 5 ? 'worsening' : secondAvg < firstAvg - 5 ? 'improving' : 'stable'

  // Red flags
  const redFlags: string[] = []
  if (bloodDays > 0) redFlags.push(`Blood in stool on ${bloodDays} day${bloodDays > 1 ? 's' : ''}`)
  if (maxPain >= 7) redFlags.push(`Pain reached ${maxPain}/10 on at least one day`)
  if (flareDays >= 3) redFlags.push(`${flareDays} high-activity days in this period`)
  if (avgSleep > 0 && avgSleep < 5.5) redFlags.push(`Poor average sleep (${avgSleep.toFixed(1)}h)`)

  const { label: scoreLabel } = getScoreLabel(avgScore)

  // Compact, serializable context shared by the rule-based fallback and the AI.
  // Plain consts (React Compiler auto-memoizes); the effect keys off the stable
  // JSON string so it only refetches when the underlying stats actually change.
  const questionContext = {
    period,
    trend,
    avgScore: Math.round(avgScore),
    diseaseActivity: scoreLabel,
    flareDays,
    bloodDays,
    maxPain,
    avgBMPerDay: Math.round(avgBMPerDay * 10) / 10,
    avgSleepHours: Math.round(avgSleep * 10) / 10,
    labs: labs.map((l) => ({
      name: l.label,
      latest: l.latest,
      unit: l.unit,
      status: l.status,
      trend: l.trend,
      prior: l.prior,
      concerning: l.concerning,
    })),
    nutrientGaps: nutrition.gaps.map((g) => g.label),
    medications: medications.map((m) => m.medName),
  }
  const contextKey = JSON.stringify(questionContext)

  // Rule-based questions — instant, used as a fallback while the AI loads / if it fails.
  const fallbackQuestions = buildGiQuestions({
    labs,
    trend,
    period,
    avgScore,
    flareDays,
    bloodDays,
    maxPain,
    avgBMPerDay,
    avgSleep,
    nutritionGaps: nutrition.gaps,
  })

  // Grok analyzes the data and writes tailored questions; refetch when stats change.
  const [aiQuestions, setAiQuestions] = useState<string[] | null>(null)
  const [questionsLoading, setQuestionsLoading] = useState(false)
  useEffect(() => {
    let cancelled = false
    const run = async () => {
      setQuestionsLoading(true)
      try {
        const res = await fetch('/api/gi-questions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: contextKey,
        })
        const data = res.ok ? await res.json() : null
        if (!cancelled) {
          setAiQuestions(Array.isArray(data?.questions) && data.questions.length ? data.questions : null)
        }
      } catch {
        if (!cancelled) setAiQuestions(null)
      } finally {
        if (!cancelled) setQuestionsLoading(false)
      }
    }
    void run()
    return () => {
      cancelled = true
    }
  }, [contextKey])

  const giQuestions = aiQuestions ?? fallbackQuestions

  const today = format(new Date(), 'MMMM d, yyyy')
  const periodStart = format(cutoff, 'MMMM d')

  return (
    <div className="flex flex-col gap-4">
      {/* Period selector */}
      <div className="flex gap-2">
        {([7, 14, 30] as const).map(p => (
          <button
            key={p}
            onClick={() => setPeriod(p)}
            className={cn(
              'flex-1 py-2 rounded-lg text-sm font-medium border transition-colors',
              period === p
                ? 'bg-primary/20 border-primary/50 text-primary'
                : 'bg-card border-border text-muted-foreground hover:text-foreground'
            )}
          >
            {p} days
          </button>
        ))}
      </div>

      {/* Report header */}
      <div className="rounded-xl border border-border bg-card p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="label-mono">GI Summary Report</p>
            <h2 className="text-lg font-bold text-foreground mt-1 text-balance">Alex — Crohn&apos;s Disease</h2>
            <p className="text-xs text-muted-foreground mt-1">
              {periodStart} – {today} ({period}-day period)
            </p>
          </div>
          <div className="p-2.5 rounded-lg bg-primary/10 border border-primary/20">
            <FileText className="h-5 w-5 text-primary" />
          </div>
        </div>

        <div className="mt-4 pt-4 border-t border-border grid grid-cols-3 gap-3">
          <StatBlock label="Avg Score" value={`${Math.round(avgScore)}`} sub={scoreLabel} highlight={avgScore >= 40} />
          <StatBlock label="Flare Days" value={`${flareDays}`} sub={`of ${period}`} highlight={flareDays >= 3} />
          <StatBlock label="Avg BM/day" value={avgBMPerDay > 0 ? avgBMPerDay.toFixed(1) : '—'} sub="bowel movements" />
        </div>
      </div>

      {/* Trend */}
      <div className="rounded-xl border border-border bg-card p-4">
        <p className="label-mono mb-3">Score Trend</p>
        <div className="flex items-center gap-2 mb-3">
          {trend === 'worsening' && <TrendingUp className="h-4 w-4 text-red-400" />}
          {trend === 'improving' && <TrendingDown className="h-4 w-4 text-emerald-400" />}
          {trend === 'stable' && <Minus className="h-4 w-4 text-muted-foreground" />}
          <span className={cn(
            'text-sm font-semibold capitalize',
            trend === 'worsening' ? 'text-red-400' : trend === 'improving' ? 'text-emerald-400' : 'text-muted-foreground'
          )}>
            {trend === 'worsening' ? 'Worsening over period' : trend === 'improving' ? 'Improving over period' : 'Stable trend'}
          </span>
        </div>
        {/* Mini chart */}
        {sortedScores.length > 0 && (
          <div className="flex items-end gap-0.5 h-10">
            {sortedScores.map(s => {
              const pct = Math.max((s.score / 100) * 36, 2)
              const barColor = s.isFlareDay ? 'bg-red-400' : s.score >= 40 ? 'bg-orange-400' : s.score >= 20 ? 'bg-yellow-400' : 'bg-emerald-400'
              return (
                <div key={s.date} className="flex-1 flex flex-col justify-end">
                  <div className={cn('w-full rounded-sm', barColor)} style={{ height: `${pct}px` }} />
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Key stats */}
      <div className="rounded-xl border border-border bg-card p-4 flex flex-col gap-3">
        <p className="label-mono">Key Statistics</p>
        <StatRow label="Avg pain score" value={avgPain > 0 ? `${avgPain.toFixed(1)}/10` : '—'} />
        <StatRow label="Max pain score" value={maxPain > 0 ? `${maxPain}/10` : '—'} highlight={maxPain >= 7} />
        <StatRow label="Blood in stool" value={bloodDays > 0 ? `${bloodDays} day${bloodDays > 1 ? 's' : ''}` : 'None reported'} highlight={bloodDays > 0} />
        <StatRow label="Avg sleep" value={avgSleep > 0 ? `${avgSleep.toFixed(1)}h` : '—'} />
        <StatRow label="Trigger food days" value={triggerMeals > 0 ? `${triggerMeals} meals` : 'None'} highlight={triggerMeals > 2} />
      </div>

      {/* Recent labs (from imported records) */}
      <div className="rounded-xl border border-border bg-card p-4">
        <div className="flex items-center gap-2 mb-3">
          <FlaskConical className="h-4 w-4 text-violet-400" />
          <p className="label-mono">Recent labs · from records</p>
        </div>
        {labs.length === 0 ? (
          <p className="text-sm text-muted-foreground leading-relaxed">
            Connect or import medical records to see labs (CRP, calprotectin, ferritin, hemoglobin…) with trends.
          </p>
        ) : (
          <div className="flex flex-col gap-3">
            {labs.map((l) => <LabRow key={l.key} lab={l} />)}
          </div>
        )}
      </div>

      {/* Nutrition · Anti-Inflammatory Diet */}
      <div className="rounded-xl border border-border bg-card p-4">
        <div className="flex items-center gap-2 mb-3">
          <Salad className="h-4 w-4 text-emerald-400" />
          <p className="label-mono">Nutrition · Anti-Inflammatory Diet</p>
        </div>
        {nutrition.daysWithNutritionData === 0 ? (
          <p className="text-sm text-muted-foreground leading-relaxed">
            Import MacroFactor nutrition data to see an anti-inflammatory nutrient analysis (omega-3, saturated fat, vitamin D, B12, calcium, iron, folate, and more).
          </p>
        ) : nutrition.gaps.length === 0 ? (
          <p className="text-sm text-muted-foreground leading-relaxed">
            Tracked nutrients look balanced over the last {nutrition.daysWithNutritionData} day{nutrition.daysWithNutritionData > 1 ? 's' : ''} of nutrition data.
          </p>
        ) : (
          <div className="flex flex-col gap-3">
            <p className="text-xs text-muted-foreground leading-relaxed">
              Based on {nutrition.daysWithNutritionData} day{nutrition.daysWithNutritionData > 1 ? 's' : ''} of imported nutrition. Reference targets are general — confirm with your GI or dietitian.
            </p>
            {nutrition.gaps.map(g => (
              <div key={g.key} className="flex flex-col gap-1">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-medium text-foreground">{g.label}</span>
                  <span className={cn(
                    'text-[10px] font-semibold uppercase tracking-wide rounded-full px-2 py-0.5 tabular-nums',
                    g.status === 'low' ? 'text-yellow-400 bg-yellow-500/10' : 'text-orange-400 bg-orange-500/10'
                  )}>
                    {g.status === 'low' ? 'Low' : 'High'} · {g.avg}{g.unit}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">{g.note}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Red flags */}
      {redFlags.length > 0 && (
        <div className="rounded-xl border border-red-500/30 bg-red-500/5 p-4">
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle className="h-4 w-4 text-red-400 flex-shrink-0" />
            <p className="text-sm font-semibold text-red-400">Red Flags for Discussion</p>
          </div>
          <ul className="flex flex-col gap-2">
            {redFlags.map((flag, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
                <span className="h-1.5 w-1.5 rounded-full bg-red-400 mt-1.5 flex-shrink-0" />
                {flag}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Medications */}
      <div className="rounded-xl border border-border bg-card p-4">
        <div className="flex items-center gap-2 mb-3">
          <Pill className="h-4 w-4 text-muted-foreground" />
          <p className="label-mono">Current Medications</p>
        </div>
        <div className="flex flex-col gap-2">
          {medications.map(med => (
            <div key={med.id} className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400 flex-shrink-0" />
                <span className="text-sm text-foreground font-medium">{med.medName}</span>
              </div>
              <span className="text-xs text-muted-foreground">{med.dose} · {med.frequency}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Questions to ask */}
      <div className="rounded-xl border border-border bg-card p-4">
        <div className="mb-3 flex items-center justify-between gap-2">
          <p className="label-mono">Suggested Questions for GI</p>
          {questionsLoading ? (
            <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
              <Loader2 className="h-3 w-3 animate-spin" /> Tailoring…
            </span>
          ) : aiQuestions ? (
            <span className="flex items-center gap-1 text-[10px] font-medium text-primary">
              <Sparkles className="h-3 w-3" /> Tailored by AI
            </span>
          ) : null}
        </div>
        <ul className="flex flex-col gap-2.5">
          {giQuestions.map((q, i) => (
            <li key={i} className="flex gap-2 text-sm text-foreground leading-relaxed">
              <span className="mt-0.5 text-primary" aria-hidden>•</span>
              <span>{q}</span>
            </li>
          ))}
        </ul>
      </div>

      <p className="text-xs text-muted-foreground text-center px-4 leading-relaxed">
        This report is generated from self-reported data. It is not a medical diagnosis and should be reviewed with your GI physician.
      </p>
    </div>
  )
}

function StatBlock({ label, value, sub, highlight }: { label: string; value: string; sub: string; highlight?: boolean }) {
  return (
    <div className="flex flex-col gap-0.5">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={cn('text-lg font-bold tabular-nums', highlight ? 'text-red-400' : 'text-foreground')}>{value}</p>
      <p className="text-xs text-muted-foreground leading-tight">{sub}</p>
    </div>
  )
}

function LabRow({ lab }: { lab: LabSummary }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-foreground">{lab.label}</span>
          {lab.concerning && (
            <span
              className={cn(
                'rounded-full px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide',
                lab.status === 'high' ? 'bg-orange-500/10 text-orange-400' : 'bg-yellow-500/10 text-yellow-400'
              )}
            >
              {lab.status}
            </span>
          )}
        </div>
        <p className="text-[11px] text-muted-foreground leading-relaxed">{lab.note} · {lab.latestDate}</p>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {lab.series.length > 1 && <LabSpark series={lab.series} bad={lab.trendIsBad} />}
        <span
          className={cn(
            'text-sm font-semibold tabular-nums',
            lab.concerning ? (lab.status === 'high' ? 'text-orange-400' : 'text-yellow-400') : 'text-foreground'
          )}
        >
          {lab.latest}{lab.unit ? ` ${lab.unit}` : ''}
        </span>
        {lab.trend === 'up' && <ArrowUp className={cn('h-3.5 w-3.5', lab.trendIsBad ? 'text-orange-400' : 'text-emerald-400')} />}
        {lab.trend === 'down' && <ArrowDown className={cn('h-3.5 w-3.5', lab.trendIsBad ? 'text-orange-400' : 'text-emerald-400')} />}
      </div>
    </div>
  )
}

function LabSpark({ series, bad }: { series: { date: string; value: number }[]; bad: boolean }) {
  const W = 48, H = 18
  const vals = series.map((p) => p.value)
  const min = Math.min(...vals)
  const span = Math.max(...vals) - min || 1
  const stepX = series.length > 1 ? W / (series.length - 1) : W
  const pts = series.map((p, i) => [i * stepX, H - ((p.value - min) / span) * (H - 4) - 2] as const)
  const line = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(' ')
  const stroke = bad ? '#fb923c' : 'oklch(var(--glow-color))'
  const last = pts[pts.length - 1]
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-[18px] w-12">
      <path d={line} fill="none" stroke={stroke} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={last[0]} cy={last[1]} r={1.8} fill={stroke} />
    </svg>
  )
}

function StatRow({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className={cn('text-sm font-semibold tabular-nums', highlight ? 'text-red-400' : 'text-foreground')}>{value}</span>
    </div>
  )
}
