import { getFlareFingerprint } from '@/lib/actions'
import { Fingerprint, ArrowUp, ArrowDown } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { MatchLevel } from '@/lib/flare-fingerprint'

const LEVEL: Record<MatchLevel, { label: string; text: string; bg: string; ring: string; dot: string }> = {
  none: { label: 'At baseline', text: 'text-emerald-400', bg: 'bg-emerald-500/10', ring: 'border-emerald-500/20', dot: 'bg-emerald-400' },
  watch: { label: 'Watch', text: 'text-yellow-400', bg: 'bg-yellow-500/10', ring: 'border-yellow-500/20', dot: 'bg-yellow-400' },
  partial: { label: 'Partial match', text: 'text-orange-400', bg: 'bg-orange-500/10', ring: 'border-orange-500/20', dot: 'bg-orange-400' },
  strong: { label: 'Matches your fingerprint', text: 'text-red-400', bg: 'bg-red-500/10', ring: 'border-red-500/30', dot: 'bg-red-400' },
}

/**
 * Compact Flare Fingerprint readout for the Today dashboard: how closely today
 * resembles the patient's learned early-warning pattern, and which signals are
 * outside baseline. Supporting evidence for the voice "what changed" moment.
 */
export async function FlareFingerprintCard() {
  const fp = await getFlareFingerprint()
  const lvl = LEVEL[fp.today.matchLevel]
  const active = fp.today.activeSignals.slice(0, 6)

  return (
    <div className={cn('rounded-2xl border p-4', lvl.ring, lvl.bg, fp.today.matchLevel === 'strong' && 'glow-strong')}>
      <div className="flex items-center justify-between gap-2 mb-2">
        <div className="flex items-center gap-2">
          <Fingerprint className={cn('h-4 w-4', lvl.text)} strokeWidth={2.2} />
          <p className="label-mono">Flare fingerprint</p>
        </div>
        <span className={cn('inline-flex items-center gap-1.5 rounded-full bg-card px-2 py-0.5 text-[11px] font-semibold', lvl.text)}>
          <span className={cn('h-1.5 w-1.5 rounded-full', lvl.dot)} />
          {lvl.label}
        </span>
      </div>

      <p className="text-sm text-foreground/90 leading-relaxed text-pretty">{fp.today.narrative}</p>

      {active.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mt-3">
          {active.map((s) => (
            <span
              key={s.key}
              className="inline-flex items-center gap-1 rounded-full bg-card border border-border px-2 py-0.5 text-[11px] font-medium text-foreground"
            >
              {s.direction === 'higherWorse' ? (
                <ArrowUp className="h-3 w-3 text-red-400" />
              ) : (
                <ArrowDown className="h-3 w-3 text-orange-400" />
              )}
              {s.label}
            </span>
          ))}
        </div>
      )}

      {fp.fingerprint.learning && (
        <p className="text-[11px] text-muted-foreground/70 mt-3 leading-relaxed">
          Still learning your fingerprint — it sharpens as more history and flares are logged.
        </p>
      )}
    </div>
  )
}
