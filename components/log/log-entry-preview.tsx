'use client'

import { Save, X } from 'lucide-react'
import { cn } from '@/lib/utils'

interface ParsedEntry {
  entryType: string
  data: Record<string, unknown>
  summary: string
}

interface LogEntryPreviewProps {
  parsed: ParsedEntry
  onChange: (updated: ParsedEntry) => void
  onSave: () => void
  onDiscard: () => void
}

const ENTRY_TYPE_LABELS: Record<string, string> = {
  bowel_movement: 'Bowel Movement',
  symptom: 'Symptoms',
  meal: 'Meal',
  medication: 'Medication',
  sleep: 'Sleep',
  exercise: 'Exercise',
}

export function LogEntryPreview({ parsed, onChange, onSave, onDiscard }: LogEntryPreviewProps) {
  function updateField(key: string, value: unknown) {
    onChange({ ...parsed, data: { ...parsed.data, [key]: value } })
  }

  return (
    <div className="rounded-xl border border-primary/30 bg-primary/5 p-4 flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Extracted entry</p>
          <p className="text-sm font-semibold text-foreground mt-0.5">
            {ENTRY_TYPE_LABELS[parsed.entryType] ?? parsed.entryType}
          </p>
        </div>
        <select
          value={parsed.entryType}
          onChange={e => onChange({ ...parsed, entryType: e.target.value })}
          className="text-xs rounded-md border border-border bg-card px-2 py-1.5 text-foreground focus:outline-none focus:ring-1 focus:ring-primary/50"
        >
          {Object.entries(ENTRY_TYPE_LABELS).map(([val, label]) => (
            <option key={val} value={val}>{label}</option>
          ))}
        </select>
      </div>

      <div className="rounded-lg border border-border bg-card p-3">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">Summary</p>
        <p className="text-sm text-foreground leading-relaxed">{parsed.summary}</p>
      </div>

      <div className="flex flex-col gap-2">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Data fields</p>
        {Object.entries(parsed.data).map(([key, value]) => (
          <div key={key} className="flex items-center gap-2">
            <label className="text-xs text-muted-foreground w-28 flex-shrink-0 capitalize">
              {key.replace(/_/g, ' ')}
            </label>
            {typeof value === 'boolean' ? (
              <input
                type="checkbox"
                checked={value}
                onChange={e => updateField(key, e.target.checked)}
                className="accent-primary"
              />
            ) : typeof value === 'number' ? (
              <input
                type="number"
                value={value}
                onChange={e => updateField(key, parseFloat(e.target.value))}
                className="flex-1 text-xs rounded border border-border bg-background px-2 py-1 text-foreground focus:outline-none focus:ring-1 focus:ring-primary/50"
              />
            ) : (
              <input
                type="text"
                value={String(value ?? '')}
                onChange={e => updateField(key, e.target.value)}
                className="flex-1 text-xs rounded border border-border bg-background px-2 py-1 text-foreground focus:outline-none focus:ring-1 focus:ring-primary/50"
              />
            )}
          </div>
        ))}
      </div>

      <div className="flex gap-2 pt-1">
        <button
          onClick={onDiscard}
          className="flex-1 flex items-center justify-center gap-1.5 rounded-lg border border-border bg-card py-2.5 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
        >
          <X className="h-3.5 w-3.5" />
          Discard
        </button>
        <button
          onClick={onSave}
          className="flex-1 flex items-center justify-center gap-1.5 rounded-lg bg-primary py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
        >
          <Save className="h-3.5 w-3.5" />
          Save Entry
        </button>
      </div>
    </div>
  )
}
