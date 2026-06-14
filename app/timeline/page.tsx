import { getRecentLogEntries, getScoreHistory, getDietGuidance } from '@/lib/actions'
import { TimelineView } from '@/components/timeline/timeline-view'

export const dynamic = 'force-dynamic'

export default async function TimelinePage() {
  const [entries, scoreHistory, diet] = await Promise.all([
    getRecentLogEntries(150),
    getScoreHistory(14),
    getDietGuidance(),
  ])

  return (
    <div className="mx-auto w-full max-w-2xl flex flex-col gap-4 px-4 pt-6 pb-4">
      <div>
        <h1 className="text-xl font-semibold text-foreground">Timeline</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Your health history, in context</p>
      </div>
      <TimelineView
        entries={entries}
        phase={diet.phase}
        phaseName={diet.phaseInfo.name}
        scoreHistory={scoreHistory.map(s => ({
          date: s.scoreDate as string,
          score: parseFloat(s.totalScore as string),
          isFlareDay: s.isFlareDayBoolean ?? false,
        }))}
      />
    </div>
  )
}
