import { getTodayScore, getRecentLogEntries, getMedications, getScoreHistory, getBaselines } from '@/lib/actions'
import { StabilityScoreCard } from '@/components/dashboard/stability-score-card'
import { DomainCards } from '@/components/dashboard/domain-cards'
import { ScoreReasons } from '@/components/dashboard/score-reasons'
import { QuickActions } from '@/components/dashboard/quick-actions'
import { TodayHeader } from '@/components/dashboard/today-header'
import { TodayLogSummary } from '@/components/dashboard/today-log-summary'

export default async function TodayPage() {
  const [scoreData, recentEntries, meds, scoreHistory] = await Promise.all([
    getTodayScore(),
    getRecentLogEntries(20),
    getMedications(),
    getScoreHistory(7),
  ])

  const todayStr = new Date().toISOString().split('T')[0]
  const todayEntries = recentEntries.filter(e => {
    const d = new Date(e.loggedAt)
    return d.toISOString().split('T')[0] === todayStr
  })

  const totalScore = scoreData ? parseFloat(scoreData.totalScore as string) : 0
  const domainScores = (scoreData?.domainScores ?? {}) as Record<string, number>
  const scoreReasons = (scoreData?.scoreReasons ?? []) as string[]

  return (
    <div className="flex flex-col gap-4 px-4 pt-6 pb-4">
      <TodayHeader patientName="Alex" />

      <StabilityScoreCard
        score={totalScore}
        scoreHistory={scoreHistory.map(s => ({
          date: s.scoreDate as string,
          score: parseFloat(s.totalScore as string),
          isFlareDay: s.isFlareDayBoolean ?? false,
        }))}
      />

      {scoreReasons.length > 0 && (
        <ScoreReasons reasons={scoreReasons} score={totalScore} />
      )}

      <DomainCards domainScores={domainScores} />

      <TodayLogSummary entries={todayEntries} medications={meds} />

      <QuickActions currentScore={totalScore} />
    </div>
  )
}
