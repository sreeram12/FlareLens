import Link from 'next/link'
import { getDietGuidance } from '@/lib/actions'
import { Salad, ChevronRight, TrendingUp, ThumbsDown } from 'lucide-react'
import { cn } from '@/lib/utils'

const ACCENT: Record<string, { text: string; bg: string; bar: string; ring: string }> = {
  emerald: { text: 'text-emerald-400', bg: 'bg-emerald-500/10', bar: 'bg-emerald-400', ring: 'border-emerald-500/20' },
  yellow: { text: 'text-yellow-400', bg: 'bg-yellow-500/10', bar: 'bg-yellow-400', ring: 'border-yellow-500/20' },
  orange: { text: 'text-orange-400', bg: 'bg-orange-500/10', bar: 'bg-orange-400', ring: 'border-orange-500/20' },
}

/**
 * Compact anti-inflammatory diet phase card for the Today dashboard.
 * Links through to the full Diet tab.
 */
export async function AidPhaseCard() {
  const { phaseInfo, todayAnti, todayPro } = await getDietGuidance()
  const accent = ACCENT[phaseInfo.accent]

  return (
    <Link
      href="/diet"
      className={cn(
        'block rounded-xl border bg-card p-4 transition-colors hover:border-foreground/20',
        accent.ring
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className={cn('flex h-9 w-9 items-center justify-center rounded-full', accent.bg)}>
            <Salad className={cn('h-5 w-5', accent.text)} strokeWidth={2} />
          </div>
          <div>
            <p className="text-xs text-muted-foreground leading-none mb-1">Anti-inflammatory diet</p>
            <p className={cn('text-sm font-semibold leading-none', accent.text)}>{phaseInfo.name}</p>
          </div>
        </div>
        <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0 mt-1" />
      </div>

      <p className="text-sm text-muted-foreground text-pretty mt-3 leading-relaxed">
        {phaseInfo.summary}
      </p>

      <div className="flex items-center gap-2 mt-3">
        <span className={cn('inline-flex items-center gap-1 rounded-full px-2 py-1 text-[11px] font-medium', accent.bg, accent.text)}>
          {phaseInfo.texture}
        </span>
      </div>

      {(todayAnti > 0 || todayPro > 0) && (
        <div className="flex items-center gap-4 mt-3 pt-3 border-t border-border">
          <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
            <TrendingUp className="h-3.5 w-3.5 text-emerald-400" />
            <span className="text-emerald-400 font-semibold tabular-nums">{todayAnti}</span> anti-inflammatory today
          </span>
          {todayPro > 0 && (
            <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
              <ThumbsDown className="h-3.5 w-3.5 text-orange-400" />
              <span className="text-orange-400 font-semibold tabular-nums">{todayPro}</span> to limit
            </span>
          )}
        </div>
      )}
    </Link>
  )
}
