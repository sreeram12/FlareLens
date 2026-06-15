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

export default async function HomePage() {
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

  // The Flare Fingerprint card already covers fingerprint/baseline findings —
  // keep the alerts feed for the rest (labs, meds, nutrition) so nothing repeats.
  const mappedSignals = signals
    .filter((f) => !['flare_fingerprint', 'baseline_drift'].includes(f.type))
    .map((f) => ({ id: f.id, type: f.type, severity: f.severity, title: f.title, detail: f.detail }))

  return (
    <div className="mx-auto w-full max-w-md lg:max-w-5xl flex flex-col gap-7 px-4 pt-6 pb-4">
      <AnalysisRefresher />
      <TodayHeader patientName="Alex" />

      {/* Primary actions toolbar */}
      <QuickActions currentScore={totalScore} />

      {/* 1 ─ How you're doing: the score is the headline, fingerprint beside it */}
      <section className="flex flex-col gap-3">
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 lg:items-start">
          <div className="flex flex-col gap-4">
            <StabilityScoreCard
              score={totalScore}
              scoreHistory={scoreHistory.map(s => ({
                date: s.scoreDate as string,
                score: parseFloat(s.totalScore as string),
                isFlareDay: s.isFlareDayBoolean ?? false,
              }))}
            />
            {scoreReasons.length > 0 && <ScoreReasons reasons={scoreReasons} score={totalScore} />}
          </div>
          <FlareFingerprintCard />
        </div>
      </section>

      {/* 2 ─ What needs attention (only renders when there's something) */}
      {mappedSignals.length > 0 && <SignalsFeed findings={mappedSignals} />}

      {/* 3 ─ Domain breakdown (self-labelled) */}
      <DomainCards domainScores={domainScores} entries={todayEntries} reasons={scoreReasons} />

      {/* 4 ─ Reference: diet phase + today's log */}
      <section className="flex flex-col gap-3">
        <p className="label-mono">Today &amp; your plan</p>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 lg:items-start">
          <AidPhaseCard />
          <TodayLogSummary entries={todayEntries} medications={meds} />
        </div>
      </section>
    </div>
  )
}
