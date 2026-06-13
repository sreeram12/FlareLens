import { format } from 'date-fns'

interface TodayHeaderProps {
  patientName: string
}

export function TodayHeader({ patientName }: TodayHeaderProps) {
  const today = new Date()
  const greeting =
    today.getHours() < 12 ? 'Good morning' :
    today.getHours() < 17 ? 'Good afternoon' : 'Good evening'

  return (
    <div>
      <p className="label-mono">{format(today, 'EEEE, MMM d')}</p>
      <h1 className="text-xl font-semibold text-foreground mt-0.5 text-balance">
        {greeting}, {patientName}
      </h1>
    </div>
  )
}
