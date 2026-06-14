import { VoiceAssistant } from '@/components/assistant/voice-assistant'
import { StabilityScoreCard } from '@/components/dashboard/stability-score-card'
import { FlareFingerprintCard } from '@/components/dashboard/flare-fingerprint-card'
import { getTodayScore, getScoreHistory, getFindings } from '@/lib/actions'

export const dynamic = 'force-dynamic'

export default async function TalkPage() {
  const [score, history, findings] = await Promise.all([
    getTodayScore(),
    getScoreHistory(7),
    getFindings(),
  ])
  const total = score ? parseFloat(score.totalScore as string) : 0

  const alerts = findings.map((f) => ({
    id: f.id,
    severity: f.severity,
    title: f.title,
    detail: f.detail,
  }))

  return (
    <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_22rem] lg:gap-5 lg:pr-4">
      <VoiceAssistant alerts={alerts} />

      {/* Laptop-only evidence rail — updates as you log in the conversation */}
      <aside className="hidden lg:flex h-[calc(100vh-2.5rem)] flex-col gap-4 overflow-y-auto py-6 pr-1">
        <p className="label-mono">Today at a glance</p>
        <StabilityScoreCard
          score={total}
          scoreHistory={history.map((s) => ({
            date: s.scoreDate as string,
            score: parseFloat(s.totalScore as string),
            isFlareDay: s.isFlareDayBoolean ?? false,
          }))}
        />
        <FlareFingerprintCard />
      </aside>
    </div>
  )
}
