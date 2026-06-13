import { getDomainLabel, type DomainScores } from '@/lib/stability-score'
import { cn } from '@/lib/utils'
import { Zap, Moon, Utensils, Pill, Dumbbell, FlaskConical, Thermometer, Activity } from 'lucide-react'

const DOMAIN_ICONS: Record<string, React.ElementType> = {
  gut: Activity,
  energy: Zap,
  nutrition: Utensils,
  medications: Pill,
  exercise: Dumbbell,
  clinical: FlaskConical,
  systemic: Thermometer,
}

interface DomainCardsProps {
  domainScores: Record<string, number>
}

function getDomainColor(score: number, maxScore: number) {
  const pct = maxScore > 0 ? score / maxScore : 0
  if (pct < 0.25) return { text: 'text-emerald-400', bar: 'bg-emerald-400', bg: 'bg-emerald-500/8' }
  if (pct < 0.5)  return { text: 'text-yellow-400',  bar: 'bg-yellow-400',  bg: 'bg-yellow-500/8' }
  if (pct < 0.75) return { text: 'text-orange-400',  bar: 'bg-orange-400',  bg: 'bg-orange-500/8' }
  return                { text: 'text-red-400',     bar: 'bg-red-400',     bg: 'bg-red-500/8' }
}

export function DomainCards({ domainScores }: DomainCardsProps) {
  const domains = (['gut', 'energy', 'nutrition', 'medications', 'exercise', 'clinical', 'systemic'] as const)

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

          return (
            <div key={key} className={cn('rounded-lg border border-border p-3 bg-card flex flex-col gap-2', bg)}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <Icon className={cn('h-3.5 w-3.5', text)} strokeWidth={2} />
                  <span className="text-xs font-medium text-foreground leading-none">{meta.name}</span>
                </div>
                <span className={cn('text-xs font-bold tabular-nums', text)}>
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
            </div>
          )
        })}
      </div>
    </div>
  )
}
