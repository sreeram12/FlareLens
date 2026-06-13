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
  const { label, color, description } = getScoreLabel(score)

  // Compute trend from last 2 days
  const sorted = [...scoreHistory].sort((a, b) => a.date.localeCompare(b.date))
  const prev = sorted.length >= 2 ? sorted[sorted.length - 2]?.score : null
  const trend = prev === null ? null : score > prev + 3 ? 'up' : score < prev - 3 ? 'down' : 'flat'

  const TrendIcon = trend === 'up' ? TrendingUp : trend === 'down' ? TrendingDown : Minus
  const trendColor = trend === 'up' ? 'text-red-400' : trend === 'down' ? 'text-emerald-400' : 'text-muted-foreground'
  const trendLabel = trend === 'up' ? 'Worsening' : trend === 'down' ? 'Improving' : 'Stable'

  return (
    <div className="glass-panel glow rounded-2xl p-5">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1">
          <p className="label-mono mb-1">Stability Score</p>
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
      {scoreHistory.length > 1 && (
        <div className="mt-4 pt-3 border-t border-border/50">
          <p className="label-mono mb-2">7-day trend</p>
          <Sparkline data={scoreHistory.slice(-7)} />
        </div>
      )}
    </div>
  )
}

function Sparkline({ data }: { data: ScoreDay[] }) {
  const W = 100
  const H = 28
  const max = Math.max(...data.map((d) => d.score), 50)
  const stepX = data.length > 1 ? W / (data.length - 1) : W
  const pts = data.map((d, i) => [i * stepX, H - (d.score / max) * (H - 4) - 2] as const)
  const line = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(' ')
  const area = `${line} L${W} ${H} L0 ${H} Z`

  return (
    <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="h-8 w-full overflow-visible">
      {/* flare-day markers (thin vertical ticks, kept crisp) */}
      {data.map((d, i) =>
        d.isFlareDay ? (
          <line key={i} x1={pts[i][0]} y1={0} x2={pts[i][0]} y2={H} stroke="#f87171" strokeOpacity={0.5} strokeWidth={1} vectorEffect="non-scaling-stroke" />
        ) : null
      )}
      <path d={area} fill="oklch(var(--glow-color) / 14%)" />
      <path
        d={line}
        fill="none"
        stroke="oklch(var(--glow-color))"
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  )
}

function ScoreDial({ score, color }: { score: number; color: string }) {
  const size = 80
  const stroke = 7
  const r = (size - stroke) / 2
  const cx = size / 2
  const cy = size / 2
  // 270-degree gauge (leaves a 90deg gap at the bottom)
  const arcFraction = 0.75
  const circumference = 2 * Math.PI * r
  const arcLength = circumference * arcFraction
  const fillRatio = Math.min(Math.max(score / 100, 0), 1)
  const filled = fillRatio * arcLength

  // Map the tailwind text color to a stroke hex
  const strokeColor =
    color.includes('emerald') ? '#34d399' :
    color.includes('yellow') ? '#facc15' :
    color.includes('orange') ? '#fb923c' :
    color.includes('red-3') ? '#fca5a5' : '#f87171'

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-[135deg]">
        {/* Track */}
        <circle
          cx={cx}
          cy={cy}
          r={r}
          fill="none"
          stroke="currentColor"
          strokeWidth={stroke}
          className="text-border"
          strokeLinecap="round"
          strokeDasharray={`${arcLength} ${circumference}`}
        />
        {/* Fill */}
        <circle
          cx={cx}
          cy={cy}
          r={r}
          fill="none"
          stroke={strokeColor}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={`${filled} ${circumference}`}
          style={{ transition: 'stroke-dasharray 0.5s ease' }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className={cn('text-lg font-bold tabular-nums leading-none', color)}>
          {Math.round(score)}
        </span>
        <span className="text-[9px] text-muted-foreground leading-none mt-0.5">/100</span>
      </div>
    </div>
  )
}
