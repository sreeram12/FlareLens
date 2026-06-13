import { format } from 'date-fns'
import { Bell } from 'lucide-react'

interface TodayHeaderProps {
  patientName: string
}

export function TodayHeader({ patientName }: TodayHeaderProps) {
  const today = new Date()
  const greeting =
    today.getHours() < 12 ? 'Good morning' :
    today.getHours() < 17 ? 'Good afternoon' : 'Good evening'

  return (
    <div className="flex items-center justify-between">
      <div>
        <p className="text-xs text-muted-foreground font-medium tracking-wide uppercase">
          {format(today, 'EEEE, MMM d')}
        </p>
        <h1 className="text-xl font-semibold text-foreground mt-0.5 text-balance">
          {greeting}, {patientName}
        </h1>
      </div>
      <button className="relative p-2 rounded-lg bg-card border border-border text-muted-foreground hover:text-foreground transition-colors">
        <Bell className="h-4 w-4" />
      </button>
    </div>
  )
}
