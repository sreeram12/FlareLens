import { getRecentLogEntries, getScoreHistory } from '@/lib/actions'
import { TimelineView } from '@/components/timeline/timeline-view'

export default async function TimelinePage() {
  const [entries, scoreHistory] = await Promise.all([
    getRecentLogEntries(100),
    getScoreHistory(14),
  ])

  return (
    <div className="flex flex-col gap-4 px-4 pt-6 pb-4">
      <div>
        <h1 className="text-xl font-semibold text-foreground">Timeline</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Your health history at a glance</p>
      </div>
      <TimelineView
        entries={entries}
        scoreHistory={scoreHistory.map(s => ({
          date: s.scoreDate as string,
          score: parseFloat(s.totalScore as string),
          isFlareDay: s.isFlareDayBoolean ?? false,
        }))}
      />
    </div>
  )
}
