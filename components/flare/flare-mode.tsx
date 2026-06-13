'use client'

import { useState } from 'react'
import { AlertTriangle, ChevronRight, CheckCircle2, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { startFlareSession, completeFlareSession } from '@/lib/actions'
import type { LogEntry } from '@/lib/db/schema'
import { getScoreLabel } from '@/lib/stability-score'

interface FlareModeProps {
  currentScore: number
  recentEntries: LogEntry[]
}

type FlareModeState = 'idle' | 'questionnaire' | 'complete'

const QUESTIONS = [
  {
    id: 'urgency',
    label: 'How urgent are your bathroom trips?',
    type: 'scale' as const,
    min: 0,
    max: 10,
    minLabel: 'No urgency',
    maxLabel: 'Extreme urgency',
  },
  {
    id: 'pain',
    label: 'Current abdominal pain level?',
    type: 'scale' as const,
    min: 0,
    max: 10,
    minLabel: 'No pain',
    maxLabel: 'Severe pain',
  },
  {
    id: 'blood',
    label: 'Have you seen blood in your stool today?',
    type: 'yesno' as const,
  },
  {
    id: 'fever',
    label: 'Do you have a fever or chills?',
    type: 'yesno' as const,
  },
  {
    id: 'eating',
    label: 'Are you able to eat and drink normally?',
    type: 'yesno' as const,
  },
  {
    id: 'missed_meds',
    label: 'Have you missed any doses recently?',
    type: 'yesno' as const,
  },
  {
    id: 'trigger',
    label: 'Did you eat any known trigger foods in the last 48h?',
    type: 'yesno' as const,
  },
  {
    id: 'notes',
    label: 'Anything else you want your doctor to know?',
    type: 'text' as const,
  },
]

export function FlareMode({ currentScore, recentEntries }: FlareModeProps) {
  const [flareModeState, setFlareModeState] = useState<FlareModeState>('idle')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [sessionId, setSessionId] = useState<number | null>(null)
  const [responses, setResponses] = useState<Record<string, unknown>>({})
  const { label, color, bgColor } = getScoreLabel(currentScore)
  const isHighScore = currentScore >= 40

  async function handleStart() {
    const session = await startFlareSession('user', currentScore)
    setSessionId(session.id)
    setFlareModeState('questionnaire')
  }

  async function handleSubmit() {
    if (!sessionId) return
    setIsSubmitting(true)
    await completeFlareSession(sessionId, responses)
    setIsSubmitting(false)
    setFlareModeState('complete')
  }

  function setResponse(id: string, value: unknown) {
    setResponses(prev => ({ ...prev, [id]: value }))
  }

  if (flareModeState === 'complete') {
    return (
      <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/5 p-8 flex flex-col items-center gap-4 text-center">
        <CheckCircle2 className="h-12 w-12 text-emerald-400" />
        <div>
          <h2 className="text-lg font-bold text-foreground">Flare check-in complete</h2>
          <p className="text-sm text-muted-foreground mt-1 leading-relaxed">
            Your responses have been saved. Head to the Report tab to generate your doctor-ready summary.
          </p>
        </div>
        <a
          href="/report"
          className="flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
        >
          View Doctor Report
          <ChevronRight className="h-4 w-4" />
        </a>
      </div>
    )
  }

  if (flareModeState === 'questionnaire') {
    return (
      <div className="flex flex-col gap-4">
        <div className="rounded-xl border border-orange-500/30 bg-orange-500/5 p-4">
          <p className="text-xs font-medium text-orange-400 uppercase tracking-wide mb-1">Flare Check-in Active</p>
          <p className="text-sm text-foreground leading-relaxed">
            Answer a few questions to document this flare episode. This will be used in your doctor report.
          </p>
        </div>

        <div className="flex flex-col gap-4">
          {QUESTIONS.map(q => (
            <div key={q.id} className="rounded-xl border border-border bg-card p-4">
              <p className="text-sm font-medium text-foreground mb-3 leading-relaxed">{q.label}</p>

              {q.type === 'scale' && (
                <div className="flex flex-col gap-2">
                  <input
                    type="range"
                    min={q.min}
                    max={q.max}
                    step={1}
                    value={Number(responses[q.id] ?? 0)}
                    onChange={e => setResponse(q.id, parseInt(e.target.value))}
                    className="w-full accent-primary"
                  />
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>{q.minLabel}</span>
                    <span className="font-bold text-foreground tabular-nums">
                      {String(responses[q.id] ?? 0)}/{q.max}
                    </span>
                    <span>{q.maxLabel}</span>
                  </div>
                </div>
              )}

              {q.type === 'yesno' && (
                <div className="flex gap-2">
                  {['Yes', 'No'].map(opt => (
                    <button
                      key={opt}
                      onClick={() => setResponse(q.id, opt === 'Yes')}
                      className={cn(
                        'flex-1 py-2 rounded-lg text-sm font-medium border transition-colors',
                        responses[q.id] === (opt === 'Yes')
                          ? 'bg-primary/20 border-primary/50 text-primary'
                          : 'bg-background border-border text-muted-foreground hover:text-foreground'
                      )}
                    >
                      {opt}
                    </button>
                  ))}
                </div>
              )}

              {q.type === 'text' && (
                <textarea
                  value={String(responses[q.id] ?? '')}
                  onChange={e => setResponse(q.id, e.target.value)}
                  placeholder="Optional — share any additional context..."
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground resize-none h-20 focus:outline-none focus:ring-1 focus:ring-primary/50"
                />
              )}
            </div>
          ))}
        </div>

        <button
          onClick={handleSubmit}
          disabled={isSubmitting}
          className="flex items-center justify-center gap-2 rounded-xl bg-primary py-3.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-60"
        >
          {isSubmitting ? (
            <><Loader2 className="h-4 w-4 animate-spin" /> Saving...</>
          ) : (
            <><CheckCircle2 className="h-4 w-4" /> Complete Flare Check-in</>
          )}
        </button>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Current score */}
      <div className={cn('rounded-xl border p-5', bgColor)}>
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Current Score</p>
            <p className={cn('text-4xl font-bold tabular-nums mt-1', color)}>{Math.round(currentScore)}</p>
            <p className={cn('text-sm font-semibold mt-0.5', color)}>{label}</p>
          </div>
          {isHighScore && (
            <div className="p-3 rounded-full bg-orange-500/15">
              <AlertTriangle className="h-6 w-6 text-orange-400" />
            </div>
          )}
        </div>
      </div>

      {/* What is flare mode */}
      <div className="rounded-xl border border-border bg-card p-4">
        <p className="text-sm font-semibold text-foreground mb-2">What is Flare Mode?</p>
        <p className="text-sm text-muted-foreground leading-relaxed">
          Flare Mode guides you through a structured check-in during a flare episode.
          Your responses are saved and used to generate a detailed GI summary report you can share with your doctor.
        </p>
      </div>

      {/* Recent summary */}
      <div className="rounded-xl border border-border bg-card p-4">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-3">Recent Activity</p>
        <div className="flex flex-col gap-2">
          {recentEntries.slice(0, 3).map(e => {
            const d = e.data as Record<string, unknown>
            let summary = ''
            if (e.entryType === 'bowel_movement') summary = `${d.count ?? '?'} BMs · Urgency ${d.urgency ?? '?'}/10`
            else if (e.entryType === 'symptom') summary = `Pain ${d.pain_scale ?? '?'}/10 · Fatigue ${d.fatigue ?? '?'}/10`
            else summary = e.entryType.replace('_', ' ')
            return (
              <div key={e.id} className="flex items-center justify-between gap-2">
                <span className="text-sm text-foreground capitalize">{e.entryType.replace('_', ' ')}</span>
                <span className="text-xs text-muted-foreground">{summary}</span>
              </div>
            )
          })}
        </div>
      </div>

      <button
        onClick={handleStart}
        className={cn(
          'flex items-center justify-center gap-2 rounded-xl py-4 text-sm font-semibold transition-colors',
          isHighScore
            ? 'bg-red-500/20 border border-red-500/40 text-red-300 hover:bg-red-500/30'
            : 'bg-primary/10 border border-primary/30 text-primary hover:bg-primary/20'
        )}
      >
        <AlertTriangle className="h-4 w-4" />
        Start Flare Check-in
      </button>
    </div>
  )
}
