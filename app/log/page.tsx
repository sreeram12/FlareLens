import { LogSurface } from '@/components/log/log-surface'

export default function LogPage() {
  return (
    <div className="flex flex-col gap-4 px-4 pt-6 pb-4">
      <div>
        <h1 className="text-xl font-semibold text-foreground">Log</h1>
        <p className="text-sm text-muted-foreground mt-0.5 leading-relaxed">
          Log by voice or snap a meal photo — review and correct before saving.
        </p>
      </div>
      <LogSurface />
    </div>
  )
}
