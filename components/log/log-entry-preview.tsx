'use client'

import { Save, X } from 'lucide-react'
import {
  getFieldSpec,
  orderedFields,
  ENTRY_TYPES,
  type FieldEditor,
} from '@/lib/health/log-schema'
import { TagChips } from './tag-chips'

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

function prettify(s: string): string {
  return s.replace(/[-_]/g, ' ').replace(/^\w/, (c) => c.toUpperCase())
}

export function LogEntryPreview({ parsed, onChange, onSave, onDiscard }: LogEntryPreviewProps) {
  function updateField(key: string, value: unknown) {
    onChange({ ...parsed, data: { ...parsed.data, [key]: value } })
  }

  const fields = orderedFields(parsed.entryType, parsed.data)

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
          onChange={(e) => onChange({ ...parsed, entryType: e.target.value })}
          className="text-xs rounded-md border border-border bg-card px-2 py-1.5 text-foreground focus:outline-none focus:ring-1 focus:ring-primary/50"
        >
          {ENTRY_TYPES.map((val) => (
            <option key={val} value={val}>
              {ENTRY_TYPE_LABELS[val] ?? val}
            </option>
          ))}
        </select>
      </div>

      <div className="rounded-lg border border-border bg-card p-3">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">Summary</p>
        <p className="text-sm text-foreground leading-relaxed">{parsed.summary}</p>
      </div>

      <div className="flex flex-col gap-3">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
          Review &amp; correct
        </p>
        {fields.map((key) => {
          const spec = getFieldSpec(parsed.entryType, key, parsed.data[key])
          return (
            <FieldRow
              key={key}
              label={spec.label}
              editor={spec.editor}
              value={parsed.data[key]}
              onChange={(v) => updateField(key, v)}
            />
          )
        })}
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

// ─── Field editors ───────────────────────────────────────────────────────────

function FieldRow({
  label,
  editor,
  value,
  onChange,
}: {
  label: string
  editor: FieldEditor
  value: unknown
  onChange: (v: unknown) => void
}) {
  // Chips and multiline text take the full width (label on its own line).
  const stacked = editor.kind === 'chips' || (editor.kind === 'text' && editor.multiline)

  if (stacked) {
    return (
      <div className="flex flex-col gap-1.5">
        <label className="text-xs text-muted-foreground">{label}</label>
        <FieldEditorControl editor={editor} value={value} onChange={onChange} label={label} />
      </div>
    )
  }

  return (
    <div className="flex items-center gap-2">
      <label className="text-xs text-muted-foreground w-28 flex-shrink-0">{label}</label>
      <FieldEditorControl editor={editor} value={value} onChange={onChange} label={label} />
    </div>
  )
}

function FieldEditorControl({
  editor,
  value,
  onChange,
  label,
}: {
  editor: FieldEditor
  value: unknown
  onChange: (v: unknown) => void
  label: string
}) {
  switch (editor.kind) {
    case 'select': {
      const current = value == null ? '' : String(value)
      // Ensure the current value is selectable even if it isn't a known option.
      const options = current && !editor.options.includes(current)
        ? [current, ...editor.options]
        : editor.options
      return (
        <select
          value={current}
          onChange={(e) => onChange(e.target.value)}
          className="flex-1 text-xs rounded border border-border bg-background px-2 py-1.5 text-foreground focus:outline-none focus:ring-1 focus:ring-primary/50"
        >
          {options.map((opt) => (
            <option key={opt} value={opt}>
              {prettify(opt)}
            </option>
          ))}
        </select>
      )
    }

    case 'chips':
      return <TagChips value={value} suggestions={editor.suggestions} onChange={onChange} />

    case 'slider': {
      const num = typeof value === 'number' ? value : Number(value) || 0
      return (
        <div className="flex-1 flex items-center gap-2">
          <input
            type="range"
            min={editor.min}
            max={editor.max}
            value={num}
            onChange={(e) => onChange(parseInt(e.target.value))}
            className="flex-1 accent-primary"
          />
          <span className="text-xs font-semibold text-foreground tabular-nums w-9 text-right">
            {num}/{editor.max}
          </span>
        </div>
      )
    }

    case 'number':
      return (
        <input
          type="number"
          min={editor.min}
          max={editor.max}
          step={editor.step}
          value={value == null ? '' : Number(value)}
          onChange={(e) => onChange(e.target.value === '' ? null : parseFloat(e.target.value))}
          className="flex-1 text-xs rounded border border-border bg-background px-2 py-1 text-foreground focus:outline-none focus:ring-1 focus:ring-primary/50"
        />
      )

    case 'boolean':
      return (
        <input
          type="checkbox"
          checked={Boolean(value)}
          onChange={(e) => onChange(e.target.checked)}
          className="accent-primary h-4 w-4"
          aria-label={label}
        />
      )

    case 'text':
      return editor.multiline ? (
        <textarea
          value={value == null ? '' : String(value)}
          onChange={(e) => onChange(e.target.value)}
          className="w-full text-sm rounded border border-border bg-background px-2 py-1.5 text-foreground resize-none h-16 focus:outline-none focus:ring-1 focus:ring-primary/50"
        />
      ) : (
        <input
          type="text"
          value={value == null ? '' : String(value)}
          onChange={(e) => onChange(e.target.value)}
          className="flex-1 text-xs rounded border border-border bg-background px-2 py-1 text-foreground focus:outline-none focus:ring-1 focus:ring-primary/50"
        />
      )
  }
}
