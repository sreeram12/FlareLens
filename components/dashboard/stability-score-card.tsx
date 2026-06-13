'use client'

import { getScoreLabel } from '@/lib/stability-score'
import { cn } from '@/lib/utils'
import { TrendingUp, TrendingDown, Minus } from 'lucide-react'

interface ScoreDay {
  date: string
  score: number
  isFlareDay: boolean
}

interface StabilityScoreCardProps {
  score: number
  scoreHistory: ScoreDay[]
}

export function StabilityScoreCard({ score, scoreHistory }: StabilityScoreCardProps) {
  const { label, color, bgColor, description } = getScoreLabel(score)

  // Compute trend from last 2 days
  const sorted = [...scoreHistory].sort((a, b) => a.date.localeCompare(b.date))
  const prev = sorted.length >= 2 ? sorted[sorted.length - 2]?.score : null
  const trend = prev === null ? null : score > prev + 3 ? 'up' : score < prev - 3 ? 'down' : 'flat'

  const TrendIcon = trend === 'up' ? TrendingUp : trend === 'down' ? TrendingDown : Minus
  const trendColor = trend === 'up' ? 'text-red-400' : trend === 'down' ? 'text-emerald-400' : 'text-muted-foreground'
  const trendLabel = trend === 'up' ? 'Worsening' : trend === 'down' ? 'Improving' : 'Stable'

  // Mini sparkline bar data (last 7 days)
  const maxScore = Math.max(...scoreHistory.map(s => s.score), 1)

  return (
    <div className={cn('rounded-xl border p-5 bg-card', bgColor)}>
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1">
          <p className="text-xs font-medium text-muted-foreground tracking-wide uppercase mb-1">
            Stability Score
          </p>
          <div className="flex items-baseline gap-2">
            <span className={cn('text-5xl font-bold tabular-nums leading-none', color)}>
              {Math.round(score)}
            </span>
            <span className="text-muted-foreground text-sm">/100</span>
          </div>
          <p className={cn('text-sm font-semibold mt-1', color)}>{label}</p>
          <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{description}</p>
        </div>

        <div className="flex flex-col items-end gap-2">
          {/* Score dial arc */}
          <ScoreDial score={score} color={color} />
          {trend !== null && (
            <div className={cn('flex items-center gap-1 text-xs font-medium', trendColor)}>
              <TrendIcon className="h-3 w-3" />
              <span>{trendLabel}</span>
            </div>
          )}
        </div>
      </div>

      {/* 7-day sparkline */}
      {scoreHistory.length > 0 && (
        <div className="mt-4 pt-3 border-t border-border/50">
          <p className="text-xs text-muted-foreground mb-2">7-day trend</p>
          <div className="flex items-end gap-1 h-8">
            {scoreHistory.slice(-7).map((day, i) => {
              const pct = maxScore > 0 ? (day.score / maxScore) : 0
              const barColor = day.isFlareDay ? 'bg-red-400' :
                day.score >= 40 ? 'bg-orange-400' :
                day.score >= 20 ? 'bg-yellow-400' : 'bg-emerald-400'
              const isToday = i === scoreHistory.slice(-7).length - 1
              return (
                <div key={day.date} className="flex-1 flex flex-col items-center gap-0.5">
                  <div
                    className={cn('w-full rounded-sm transition-all', barColor, isToday ? 'opacity-100' : 'opacity-60')}
                    style={{ height: `${Math.max(pct * 28, 3)}px` }}
                  />
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

function ScoreDial({ score, color }: { score: number; color: string }) {
  const size = 72
  const r = 28
  const cx = size / 2
  const cy = size / 2
  const circumference = Math.PI * r // half circle
  const fillRatio = Math.min(score / 100, 1)
  const filled = fillRatio * circumference

  // Extract a CSS color from the tailwind class for stroke
  const strokeColor =
    color.includes('emerald') ? '#34d399' :
    color.includes('yellow') ? '#facc15' :
    color.includes('orange') ? '#fb923c' :
    color.includes('red-3') ? '#fca5a5' : '#f87171'

  return (
    <svg width={size} height={size / 2 + 6} viewBox={`0 0 ${size} ${size / 2 + 6}`}>
      {/* Track */}
      <path
        d={`M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`}
        fill="none"
        stroke="currentColor"
        strokeWidth="6"
        className="text-border"
        strokeLinecap="round"
      />
      {/* Fill */}
      <path
        d={`M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`}
        fill="none"
        stroke={strokeColor}
        strokeWidth="6"
        strokeLinecap="round"
        strokeDasharray={`${filled} ${circumference}`}
        style={{ transition: 'stroke-dasharray 0.5s ease' }}
      />
    </svg>
  )
}
