import { getTodayScore, getRecentLogEntries, getMedications, getScoreHistory, getFindings } from '@/lib/actions'
import { StabilityScoreCard } from '@/components/dashboard/stability-score-card'
import { SignalsFeed } from '@/components/dashboard/signals-feed'
import { AnalysisRefresher } from '@/components/dashboard/analysis-refresher'
import { DomainCards } from '@/components/dashboard/domain-cards'
import { ScoreReasons } from '@/components/dashboard/score-reasons'
import { QuickActions } from '@/components/dashboard/quick-actions'
import { TodayHeader } from '@/components/dashboard/today-header'
import { TodayLogSummary } from '@/components/dashboard/today-log-summary'
import { AidPhaseCard } from '@/components/dashboard/aid-phase-card'
import { FlareFingerprintCard } from '@/components/dashboard/flare-fingerprint-card'

export const dynamic = 'force-dynamic'

export default async function TodayPage() {
  const [scoreData, recentEntries, meds, scoreHistory, signals] = await Promise.all([
    getTodayScore(),
    getRecentLogEntries(20),
    getMedications(),
    getScoreHistory(7),
    getFindings(), // read stored findings (read-only); refresh happens post-mount
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
      <AnalysisRefresher />
      <TodayHeader patientName="Alex" />

      <SignalsFeed
        findings={signals.map((f) => ({
          id: f.id,
          type: f.type,
          severity: f.severity,
          title: f.title,
          detail: f.detail,
        }))}
      />

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

      <FlareFingerprintCard />

      <DomainCards domainScores={domainScores} entries={todayEntries} reasons={scoreReasons} />

      <AidPhaseCard />

      <TodayLogSummary entries={todayEntries} medications={meds} />

      <QuickActions currentScore={totalScore} />
    </div>
  )
}
