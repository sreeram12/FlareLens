import { getFlareFingerprint } from '@/lib/actions'
import { Fingerprint, ArrowUp, ArrowDown, Check, Lightbulb } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { MatchLevel } from '@/lib/flare-fingerprint'

const LEVEL: Record<MatchLevel, { label: string; lead: string; text: string; bg: string; ring: string; dot: string }> = {
  none: {
    label: 'At baseline',
    lead: 'Today looks like a normal day for you — nothing is drifting toward your flare pattern.',
    text: 'text-emerald-400', bg: 'bg-emerald-500/10', ring: 'border-emerald-500/20', dot: 'bg-emerald-400',
  },
  watch: {
    label: 'Worth watching',
    lead: 'A signal or two is off your usual baseline. Not your flare pattern yet, but keep an eye on it.',
    text: 'text-yellow-400', bg: 'bg-yellow-500/10', ring: 'border-yellow-500/20', dot: 'bg-yellow-400',
  },
  partial: {
    label: 'Partial match',
    lead: 'Several signals match the early part of your flare pattern.',
    text: 'text-orange-400', bg: 'bg-orange-500/10', ring: 'border-orange-500/20', dot: 'bg-orange-400',
  },
  strong: {
    label: 'Looks pre-flare',
    lead: 'Today closely matches the pattern that usually shows up before your flares.',
    text: 'text-red-400', bg: 'bg-red-500/10', ring: 'border-red-500/30', dot: 'bg-red-400',
  },
}

// Short, signal-specific things the patient can actually do.
const TIPS: Record<string, string> = {
  restingHeartRate: 'Rest, hydrate, and keep movement gentle today.',
  hrv: 'Prioritize sleep and recovery; ease off hard exercise.',
  sleepHours: 'Protect tonight’s sleep — wind down early.',
  respiratoryRate: 'Rest and watch for signs of illness.',
  fatigue: 'Scale back exertion and build in rest.',
  abdominalPain: 'Favor gentle, low-residue foods and note any triggers.',
  urgency: 'Stick to easy-to-digest meals and stay hydrated.',
  bloating: 'Ease off raw/high-FODMAP foods; try smaller meals.',
  nausea: 'Small bland meals and fluids; ginger can help.',
  bowelMovements: 'Hydrate, favor soluble fiber, and log triggers.',
  intakeCalories: 'Aim for small, frequent, nourishing meals.',
  steps: 'A short, gentle walk if you’re up to it.',
}

const ACTION: Record<MatchLevel, string | null> = {
  none: null,
  watch: 'Keep logging and take it easy today — most of these settle on their own.',
  partial: 'Lean on anti-inflammatory foods, scale back activity, and keep logging. If it builds over a day or two, message your GI.',
  strong: 'Log how you feel, shift your diet toward the introduction phase, and consider contacting your GI — catching it early helps.',
}

/**
 * Flare Fingerprint — the patient's personal early-warning pattern. Explains what
 * it is, which signals are off baseline today, and what to do about it.
 */
export async function FlareFingerprintCard() {
  const fp = await getFlareFingerprint()
  const lvl = LEVEL[fp.today.matchLevel]
  const active = fp.today.activeSignals.slice(0, 3)

  return (
    <div className={cn('rounded-2xl border p-4', lvl.ring, lvl.bg, fp.today.matchLevel === 'strong' && 'glow-strong')}>
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Fingerprint className={cn('h-4 w-4', lvl.text)} strokeWidth={2.2} />
          <p className="label-mono">Flare fingerprint</p>
        </div>
        <span className={cn('inline-flex items-center gap-1.5 rounded-full bg-card px-2 py-0.5 text-[11px] font-semibold', lvl.text)}>
          <span className={cn('h-1.5 w-1.5 rounded-full', lvl.dot)} />
          {lvl.label}
        </span>
      </div>

      {/* What it is */}
      <p className="mt-1.5 text-[11px] leading-relaxed text-muted-foreground">
        Your personal early-warning pattern — the signals that tend to shift in the days before a flare.
      </p>

      {/* Plain-language status */}
      <p className="mt-2 text-sm leading-relaxed text-foreground/90 text-pretty">{lvl.lead}</p>

      {/* Signals off baseline + what to do about each */}
      {active.length > 0 ? (
        <div className="mt-3 flex flex-col gap-2">
          {active.map((s) => (
            <div key={s.key} className="rounded-lg border border-border bg-card/60 p-2.5">
              <div className="flex items-center gap-1.5">
                {s.direction === 'higherWorse'
                  ? <ArrowUp className="h-3.5 w-3.5 text-red-400" />
                  : <ArrowDown className="h-3.5 w-3.5 text-orange-400" />}
                <span className="text-xs font-semibold text-foreground">{s.label}</span>
                <span className="text-[11px] text-muted-foreground">
                  {s.direction === 'higherWorse' ? 'above' : 'below'} your usual ({s.value} vs ~{s.baseline})
                </span>
              </div>
              {TIPS[s.key] && (
                <p className="mt-1 flex items-start gap-1.5 text-[11px] leading-relaxed text-muted-foreground">
                  <Lightbulb className="mt-0.5 h-3 w-3 shrink-0 text-primary/80" />
                  {TIPS[s.key]}
                </p>
              )}
            </div>
          ))}
        </div>
      ) : (
        <p className="mt-3 flex items-center gap-1.5 text-xs text-emerald-400">
          <Check className="h-3.5 w-3.5" strokeWidth={2.6} /> All tracked signals are within your normal range.
        </p>
      )}

      {/* What to do overall */}
      {ACTION[fp.today.matchLevel] && (
        <p className="mt-3 rounded-lg bg-card/60 border border-border p-2.5 text-[11px] leading-relaxed text-foreground/90">
          <span className={cn('font-semibold', lvl.text)}>What to do: </span>
          {ACTION[fp.today.matchLevel]}
        </p>
      )}

      {fp.fingerprint.learning && (
        <p className="mt-3 text-[11px] leading-relaxed text-muted-foreground/70">
          Still learning your fingerprint — it sharpens as more history and flares are logged.
        </p>
      )}
    </div>
  )
}
