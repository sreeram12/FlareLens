import { getRecentLogEntries, getTodayScore } from '@/lib/actions'
import { FlareMode } from '@/components/flare/flare-mode'

export default async function FlarePage() {
  const [entries, scoreData] = await Promise.all([
    getRecentLogEntries(50),
    getTodayScore(),
  ])

  const currentScore = scoreData ? parseFloat(scoreData.totalScore as string) : 0

  return (
    <div className="mx-auto w-full max-w-2xl lg:max-w-3xl flex flex-col gap-4 px-4 pt-6 pb-4">
      <div className="mb-2">
        <h1 className="text-xl font-semibold text-foreground">Flare Mode</h1>
        <p className="text-sm text-muted-foreground">Log your flare and generate a GI summary</p>
      </div>
      <FlareMode currentScore={currentScore} recentEntries={entries} />
    </div>
  )
}
