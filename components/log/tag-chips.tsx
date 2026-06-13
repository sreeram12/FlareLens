'use client'

import { X } from 'lucide-react'
import { cn } from '@/lib/utils'

/**
 * Toggleable tag-chip editor shared by the voice/photo preview and the manual
 * form. Stores an array of tag ids; renders suggestion labels, and keeps any
 * selected ids that aren't in the suggestion palette visible + removable.
 */
export function TagChips({
  value,
  suggestions,
  onChange,
}: {
  value: unknown
  suggestions: readonly { id: string; label: string }[]
  onChange: (v: string[]) => void
}) {
  const selected: string[] = Array.isArray(value) ? value.map(String) : []
  const labelFor = (id: string) =>
    suggestions.find((s) => s.id === id)?.label ?? id.replace(/[-_]/g, ' ')

  function toggle(id: string) {
    onChange(selected.includes(id) ? selected.filter((t) => t !== id) : [...selected, id])
  }

  const extras = selected.filter((id) => !suggestions.some((s) => s.id === id))

  return (
    <div className="flex flex-wrap gap-1.5">
      {extras.map((id) => (
        <button
          key={id}
          type="button"
          onClick={() => toggle(id)}
          className="inline-flex items-center gap-1 rounded-full border border-primary/50 bg-primary/15 px-2 py-1 text-[11px] font-medium text-primary"
        >
          {labelFor(id)}
          <X className="h-3 w-3" />
        </button>
      ))}
      {suggestions.map((s) => {
        const on = selected.includes(s.id)
        return (
          <button
            key={s.id}
            type="button"
            onClick={() => toggle(s.id)}
            className={cn(
              'inline-flex items-center gap-1 rounded-full border px-2 py-1 text-[11px] font-medium transition-colors',
              on
                ? 'border-primary/50 bg-primary/15 text-primary'
                : 'border-border bg-card text-muted-foreground hover:text-foreground'
            )}
          >
            {s.label}
            {on && <X className="h-3 w-3" />}
          </button>
        )
      })}
    </div>
  )
}
