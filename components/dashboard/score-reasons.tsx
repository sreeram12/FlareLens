import { AlertTriangle, Info } from 'lucide-react'
import { cn } from '@/lib/utils'

interface ScoreReasonsProps {
  reasons: string[]
  score: number
}

export function ScoreReasons({ reasons, score }: ScoreReasonsProps) {
  const isHighScore = score >= 40
  const Icon = isHighScore ? AlertTriangle : Info
  const iconColor = isHighScore ? 'text-orange-400' : 'text-primary'
  const borderColor = isHighScore ? 'border-orange-500/20 bg-orange-500/5' : 'border-primary/20 bg-primary/5'

  return (
    <div className={cn('rounded-xl border p-4', borderColor)}>
      <div className="flex items-center gap-2 mb-3">
        <Icon className={cn('h-4 w-4 flex-shrink-0', iconColor)} strokeWidth={2} />
        <p className="text-sm font-semibold text-foreground">
          {isHighScore ? 'Key contributors to your score' : 'Score factors today'}
        </p>
      </div>
      <ul className="flex flex-col gap-2">
        {reasons.slice(0, 3).map((reason, i) => (
          <li key={i} className="flex items-start gap-2 text-sm text-muted-foreground leading-relaxed">
            <span className={cn('h-1.5 w-1.5 rounded-full mt-1.5 flex-shrink-0', isHighScore ? 'bg-orange-400' : 'bg-primary')} />
            {reason}
          </li>
        ))}
      </ul>
    </div>
  )
}
