import { format } from 'date-fns'
import type { LogEntry, Medication } from '@/lib/db/schema'
import { Droplets, Heart, Utensils, Pill, Moon, Dumbbell, CheckCircle2, Circle, HeartPulse, Scale, FlaskConical, Stethoscope } from 'lucide-react'
import { cn } from '@/lib/utils'

const ENTRY_META: Record<string, { label: string; icon: React.ElementType; color: string }> = {
  bowel_movement: { label: 'BM', icon: Droplets, color: 'text-blue-400' },
  symptom:        { label: 'Symptom', icon: Heart, color: 'text-pink-400' },
  meal:           { label: 'Meal', icon: Utensils, color: 'text-teal-400' },
  medication:     { label: 'Med', icon: Pill, color: 'text-purple-400' },
  sleep:          { label: 'Sleep', icon: Moon, color: 'text-indigo-400' },
  exercise:       { label: 'Exercise', icon: Dumbbell, color: 'text-emerald-400' },
  wearable:       { label: 'Wearable', icon: HeartPulse, color: 'text-cyan-400' },
  weight:         { label: 'Body', icon: Scale, color: 'text-amber-400' },
  lab:            { label: 'Lab', icon: FlaskConical, color: 'text-violet-400' },
  clinical:       { label: 'Record', icon: Stethoscope, color: 'text-violet-400' },
}

interface TodayLogSummaryProps {
  entries: LogEntry[]
  medications: Medication[]
}

function entryDescription(entry: LogEntry): string {
  const d = entry.data as Record<string, unknown>
  switch (entry.entryType) {
    case 'bowel_movement':
      return `${d.count ?? '?'} BM${Number(d.count) !== 1 ? 's' : ''} · Urgency ${d.urgency ?? '?'}/10${d.blood ? ' · Blood' : ''}`
    case 'symptom':
      return `Pain ${d.pain_scale ?? '?'}/10 · Fatigue ${d.fatigue ?? '?'}/10`
    case 'meal':
      return `${d.description ?? 'Logged meal'} (${d.calories ?? '?'} kcal)`
    case 'medication':
      return `${d.med_name ?? 'Med'} ${d.taken === false ? '— missed' : '— taken'}`
    case 'sleep':
      return `${d.duration_hours ?? '?'}h · Quality ${d.quality ?? '?'}/10`
    case 'exercise':
      return `${d.type ?? 'Exercise'} ${d.duration_minutes ?? '?'} min · ${Number(d.steps ?? 0).toLocaleString()} steps`
    case 'wearable':
      return [
        d.sleep_hours != null ? `Sleep ${d.sleep_hours}h` : null,
        d.resting_hr != null ? `RHR ${d.resting_hr}` : null,
        d.hrv != null ? `HRV ${d.hrv}` : null,
        d.steps != null ? `${Number(d.steps).toLocaleString()} steps` : null,
      ].filter(Boolean).join(' · ') || 'Wearable metrics'
    case 'weight':
      return [
        d.weight_kg != null ? `${d.weight_kg} kg` : null,
        d.fat_percent != null ? `${d.fat_percent}% body fat` : null,
      ].filter(Boolean).join(' · ') || 'Body metrics'
    case 'lab':
      return `${d.lab_name ?? 'Lab'}: ${d.value ?? '?'}${d.unit ? ' ' + d.unit : ''}`
    case 'clinical':
      return `${d.text ?? 'Record'}${d.kind ? ` (${d.kind})` : ''}`
    default:
      return typeof d.description === 'string' ? d.description : 'Logged entry'
  }
}

function MedChecklist({ medications }: { medications: Medication[] }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <p className="text-xs font-medium text-muted-foreground tracking-wide uppercase mb-3">
        Medications
      </p>
      <div className="flex flex-col gap-2">
        {medications.map(med => (
          <div key={med.id} className="flex items-center gap-3">
            <CheckCircle2 className="h-4 w-4 text-emerald-400 flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground truncate">{med.medName}</p>
              <p className="text-xs text-muted-foreground">{med.dose} · {med.frequency}</p>
            </div>
          </div>
        ))}
        {medications.length === 0 && (
          <p className="text-sm text-muted-foreground">No medications on record</p>
        )}
      </div>
    </div>
  )
}

export function TodayLogSummary({ entries, medications }: TodayLogSummaryProps) {
  return (
    <div className="flex flex-col gap-3">
      <MedChecklist medications={medications} />

      {entries.length > 0 && (
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="text-xs font-medium text-muted-foreground tracking-wide uppercase mb-3">
            Today&apos;s Logs
          </p>
          <div className="flex flex-col gap-3">
            {entries.slice(0, 5).map(entry => {
              const meta = ENTRY_META[entry.entryType] ?? { label: entry.entryType, icon: Circle, color: 'text-muted-foreground' }
              const Icon = meta.icon
              return (
                <div key={entry.id} className="flex items-start gap-3">
                  <div className={cn('mt-0.5 h-5 w-5 flex-shrink-0 flex items-center justify-center rounded-md bg-card border border-border', meta.color)}>
                    <Icon className="h-3 w-3" strokeWidth={2} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-xs font-semibold text-foreground uppercase tracking-wide">{meta.label}</p>
                      <span className="text-xs text-muted-foreground flex-shrink-0">
                        {format(new Date(entry.loggedAt), 'h:mm a')}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground leading-relaxed mt-0.5 truncate">
                      {entryDescription(entry)}
                    </p>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
