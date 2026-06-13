import { getRecentLogEntries, getScoreHistory, getMedications } from '@/lib/actions'
import { DoctorReport } from '@/components/report/doctor-report'

export const dynamic = 'force-dynamic'

export default async function ReportPage() {
  const [entries, scoreHistory, meds] = await Promise.all([
    getRecentLogEntries(100),
    getScoreHistory(30),
    getMedications(),
  ])

  return (
    <div className="flex flex-col gap-4 px-4 pt-6 pb-4">
      <div className="flex items-center gap-3 mb-2">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Doctor Report</h1>
          <p className="text-sm text-muted-foreground">GI-ready summary for your next appointment</p>
        </div>
      </div>
      <DoctorReport entries={entries} scoreHistory={scoreHistory} medications={meds} />
    </div>
  )
}
