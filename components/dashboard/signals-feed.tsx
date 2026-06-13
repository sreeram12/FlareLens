'use client'

import { useState } from 'react'
import { dismissFinding } from '@/lib/actions'
import { Sparkles, X, Activity, FlaskConical, Pill, Salad } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface SignalItem {
  id: number
  type: string
  severity: string
  title: string
  detail: string
}

const SEV: Record<string, { text: string; ring: string; bg: string }> = {
  alert: { text: 'text-red-400', ring: 'border-red-500/30', bg: 'bg-red-500/10' },
  watch: { text: 'text-orange-400', ring: 'border-orange-500/25', bg: 'bg-orange-500/10' },
  info: { text: 'text-primary', ring: 'border-border', bg: 'bg-primary/10' },
}

const ICON: Record<string, typeof Activity> = {
  flare_fingerprint: Activity,
  baseline_drift: Activity,
  lab_shift: FlaskConical,
  med_adherence: Pill,
  nutrient_gap: Salad,
}

/**
 * "FlareLens noticed…" — the background analyst's findings surfaced on Today.
 * Dismiss optimistically, then persist via the server action.
 */
export function SignalsFeed({ findings }: { findings: SignalItem[] }) {
  const [items, setItems] = useState(findings)
  if (items.length === 0) return null

  async function dismiss(id: number) {
    setItems((prev) => prev.filter((f) => f.id !== id))
    await dismissFinding(id)
  }

  return (
    <section className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <Sparkles className="h-4 w-4 text-primary text-glow" strokeWidth={2.2} />
        <p className="label-mono">FlareLens noticed</p>
      </div>

      {items.map((f) => {
        const sev = SEV[f.severity] ?? SEV.info
        const Icon = ICON[f.type] ?? Activity
        return (
          <div key={f.id} className={cn('glass-panel rounded-xl p-3 flex items-start gap-3', sev.ring)}>
            <div className={cn('mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full', sev.bg)}>
              <Icon className={cn('h-3.5 w-3.5', sev.text)} />
            </div>
            <div className="flex-1 min-w-0">
              <p className={cn('text-sm font-semibold', sev.text)}>{f.title}</p>
              <p className="text-xs text-muted-foreground leading-relaxed mt-0.5 text-pretty">{f.detail}</p>
            </div>
            <button
              onClick={() => dismiss(f.id)}
              aria-label="Dismiss"
              className="text-muted-foreground hover:text-foreground shrink-0 transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        )
      })}
    </section>
  )
}
