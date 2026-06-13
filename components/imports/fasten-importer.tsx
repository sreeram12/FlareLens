'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { saveFastenImport } from '@/lib/actions'
import type { FastenRecords } from '@/lib/fasten-fhir'
import {
  HeartPulse, Loader2, CheckCircle2, AlertCircle, FlaskConical, Pill, Stethoscope, Sparkles,
} from 'lucide-react'
import { cn } from '@/lib/utils'

type Status = 'idle' | 'parsing' | 'preview' | 'saving' | 'done' | 'error'

interface ImporterProps {
  alreadyImported: number
}

export function FastenImporter({ alreadyImported }: ImporterProps) {
  const router = useRouter()
  const inputRef = useRef<HTMLInputElement>(null)
  const [status, setStatus] = useState<Status>('idle')
  const [error, setError] = useState<string | null>(null)
  const [records, setRecords] = useState<FastenRecords | null>(null)
  const [result, setResult] = useState<{ labsInserted: number; clinicalInserted: number; medsInserted: number; skipped: number } | null>(null)

  async function parseResponse(res: Response) {
    const json = await res.json()
    if (!res.ok) {
      setError(json.error ?? 'Failed to parse FHIR data')
      setStatus('error')
      return
    }
    setRecords(json as FastenRecords)
    setStatus('preview')
  }

  async function handleFile(file: File) {
    setError(null)
    setStatus('parsing')
    const form = new FormData()
    form.append('file', file)
    try {
      await parseResponse(await fetch('/api/import-fasten', { method: 'POST', body: form }))
    } catch {
      setError('Could not read the file. Make sure it is a valid FHIR .ndjson export.')
      setStatus('error')
    }
  }

  async function loadSample() {
    setError(null)
    setStatus('parsing')
    try {
      await parseResponse(
        await fetch('/api/import-fasten', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sample: true }),
        })
      )
    } catch {
      setError('Could not load the sample records.')
      setStatus('error')
    }
  }

  async function handleSave() {
    if (!records) return
    setStatus('saving')
    try {
      const r = await saveFastenImport(records)
      setResult(r)
      setStatus('done')
      router.refresh()
    } catch {
      setError('Failed to save imported records.')
      setStatus('error')
    }
  }

  function reset() {
    setStatus('idle')
    setError(null)
    setRecords(null)
    setResult(null)
    if (inputRef.current) inputRef.current.value = ''
  }

  const labDates = records?.labs.map((l) => l.observedAt).filter(Boolean).sort() as string[] | undefined
  const dateRange = labDates && labDates.length ? `${labDates[0]} → ${labDates[labDates.length - 1]}` : ''

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-rose-500/15">
          <HeartPulse className="h-4 w-4 text-rose-400" strokeWidth={2.2} />
        </div>
        <div>
          <h2 className="text-sm font-semibold text-foreground">Medical records (Fasten)</h2>
          <p className="text-xs text-muted-foreground">Conditions, medications, labs &amp; visits from your patient portal</p>
        </div>
      </div>

      {alreadyImported > 0 && status === 'idle' && (
        <div className="flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-xs text-muted-foreground">
          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
          {alreadyImported} medical {alreadyImported === 1 ? 'record' : 'records'} already imported.
        </div>
      )}

      {(status === 'idle' || status === 'parsing' || status === 'error') && (
        <>
          <div
            onClick={() => status !== 'parsing' && inputRef.current?.click()}
            className={cn(
              'flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed p-6 text-center cursor-pointer transition-colors',
              'border-border bg-card hover:border-primary/40',
              status === 'parsing' && 'pointer-events-none opacity-70'
            )}
          >
            {status === 'parsing' ? (
              <>
                <Loader2 className="h-7 w-7 text-primary animate-spin" />
                <p className="text-sm text-muted-foreground">Reading records…</p>
              </>
            ) : (
              <>
                <div className="flex h-11 w-11 items-center justify-center rounded-full bg-primary/15">
                  <FlaskConical className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-sm font-medium text-foreground">Upload a Fasten FHIR export</p>
                  <p className="text-xs text-muted-foreground mt-0.5">tap to browse · .ndjson / .json</p>
                </div>
              </>
            )}
            <input
              ref={inputRef}
              type="file"
              accept=".ndjson,.json,.jsonl,application/x-ndjson,application/json"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0]
                if (f) handleFile(f)
              }}
            />
          </div>

          {status !== 'parsing' && (
            <button
              onClick={loadSample}
              className="flex items-center justify-center gap-2 rounded-xl border border-border bg-card py-2.5 text-sm font-medium text-foreground hover:border-primary/40 transition-colors"
            >
              <Sparkles className="h-4 w-4 text-primary" /> Load sample records (demo)
            </button>
          )}

          {status === 'error' && error && (
            <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2.5">
              <AlertCircle className="h-4 w-4 text-destructive flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-sm text-destructive">{error}</p>
                <button onClick={reset} className="text-xs text-muted-foreground underline mt-1">Try again</button>
              </div>
            </div>
          )}

          <p className="text-xs text-muted-foreground/70 leading-relaxed px-1">
            Live one-tap connect to your patient portal turns on once Fasten Connect credentials are configured. Until then, import an export file or load the sample.
          </p>
        </>
      )}

      {status === 'preview' && records && (
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-3 gap-2">
            <StatCard label="Labs" value={records.counts.labs} icon={FlaskConical} />
            <StatCard label="Medications" value={records.counts.medications} icon={Pill} />
            <StatCard label="History" value={records.counts.conditions + records.counts.encounters + records.counts.procedures} icon={Stethoscope} />
          </div>

          {records.labs.length > 0 && (
            <div className="rounded-lg border border-border bg-card overflow-hidden">
              <div className="flex items-center justify-between px-3 pt-3 pb-1.5">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Labs</p>
                {dateRange && <span className="text-xs text-muted-foreground">{dateRange}</span>}
              </div>
              <div className="divide-y divide-border">
                {records.labs.slice(0, 8).map((l, i) => (
                  <div key={i} className="flex items-center justify-between px-3 py-2">
                    <span className="text-xs font-medium text-foreground">{l.name}</span>
                    <span className="text-xs text-muted-foreground tabular-nums">
                      {l.value}{l.unit ? ` ${l.unit}` : ''}{l.observedAt ? ` · ${l.observedAt}` : ''}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {records.medications.length > 0 && (
            <div className="rounded-lg border border-border bg-card p-3">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Medications</p>
              <div className="flex flex-col gap-1">
                {records.medications.map((m, i) => (
                  <span key={i} className="text-xs text-foreground">{m.name}</span>
                ))}
              </div>
            </div>
          )}

          <div className="flex gap-2">
            <button onClick={reset} className="flex-1 rounded-xl border border-border bg-card py-3 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
              Cancel
            </button>
            <button onClick={handleSave} className="flex-[2] flex items-center justify-center gap-2 rounded-xl bg-primary py-3 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-colors">
              <HeartPulse className="h-4 w-4" /> Import {records.counts.total} records
            </button>
          </div>
        </div>
      )}

      {status === 'saving' && (
        <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-border bg-card p-8">
          <Loader2 className="h-8 w-8 text-primary animate-spin" />
          <p className="text-sm text-muted-foreground">Saving medical records…</p>
        </div>
      )}

      {status === 'done' && result && (
        <div className="flex flex-col gap-4">
          <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-6 text-center">
            <CheckCircle2 className="h-10 w-10 text-emerald-400" />
            <div>
              <p className="text-base font-semibold text-foreground">Records imported</p>
              <p className="text-sm text-muted-foreground mt-1">
                {result.labsInserted} labs, {result.medsInserted} medications, and {result.clinicalInserted} history items added
                {result.skipped > 0 && `, ${result.skipped} already present`}.
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={reset} className="flex-1 rounded-xl border border-border bg-card py-3 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
              Import more
            </button>
            <button onClick={() => router.push('/report')} className="flex-1 rounded-xl bg-primary py-3 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-colors">
              View report
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function StatCard({ label, value, icon: Icon }: { label: string; value: number; icon: React.ElementType }) {
  return (
    <div className="flex flex-col items-center gap-1 rounded-lg border border-border bg-card p-3">
      <Icon className="h-4 w-4 text-primary" />
      <span className="text-lg font-semibold text-foreground tabular-nums">{value}</span>
      <span className="text-xs text-muted-foreground">{label}</span>
    </div>
  )
}
