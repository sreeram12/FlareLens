'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { saveMacroFactorImport } from '@/lib/actions'
import type { ParsedDay } from '@/lib/macrofactor-parser'
import {
  Upload, FileSpreadsheet, Loader2, CheckCircle2, AlertCircle,
  Flame, Scale, Beef, Wheat, Droplet,
} from 'lucide-react'
import { cn } from '@/lib/utils'

type Status = 'idle' | 'parsing' | 'preview' | 'saving' | 'done' | 'error'

interface ParseResponse {
  days: ParsedDay[]
  detectedColumns: string[]
  sheetSummary: { name: string; rows: number; matched: string[] }[]
}

interface ImporterProps {
  alreadyImported: number
}

export function MacroFactorImporter({ alreadyImported }: ImporterProps) {
  const router = useRouter()
  const inputRef = useRef<HTMLInputElement>(null)
  const [status, setStatus] = useState<Status>('idle')
  const [error, setError] = useState<string | null>(null)
  const [dragging, setDragging] = useState(false)
  const [fileName, setFileName] = useState<string>('')
  const [parsed, setParsed] = useState<ParseResponse | null>(null)
  const [result, setResult] = useState<{ mealsInserted: number; weightsInserted: number; updated: number; totalDays: number } | null>(null)

  async function handleFile(file: File) {
    setError(null)
    setFileName(file.name)
    setStatus('parsing')

    const form = new FormData()
    form.append('file', file)

    try {
      const res = await fetch('/api/import-macrofactor', { method: 'POST', body: form })
      const json = await res.json()

      if (!res.ok) {
        setError(json.error ?? 'Failed to parse file')
        setStatus('error')
        return
      }

      setParsed(json as ParseResponse)
      setStatus('preview')
    } catch {
      setError('Could not read the file. Make sure it is a valid MacroFactor .csv or .xlsx export.')
      setStatus('error')
    }
  }

  async function handleSave() {
    if (!parsed) return
    setStatus('saving')
    try {
      const r = await saveMacroFactorImport(parsed.days)
      setResult(r)
      setStatus('done')
      router.refresh()
    } catch {
      setError('Failed to save imported data.')
      setStatus('error')
    }
  }

  function reset() {
    setStatus('idle')
    setError(null)
    setParsed(null)
    setResult(null)
    setFileName('')
    if (inputRef.current) inputRef.current.value = ''
  }

  // ── Summary stats for the preview ──
  const stats = parsed
    ? {
        days: parsed.days.length,
        withCalories: parsed.days.filter((d) => d.calories !== undefined).length,
        withWeight: parsed.days.filter((d) => d.weightKg !== undefined || d.trendWeightKg !== undefined).length,
        withSteps: parsed.days.filter((d) => d.steps !== undefined).length,
        dateRange:
          parsed.days.length > 0
            ? `${parsed.days[0].date} → ${parsed.days[parsed.days.length - 1].date}`
            : '',
      }
    : null

  return (
    <div className="flex flex-col gap-4">
      {alreadyImported > 0 && status === 'idle' && (
        <div className="flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-xs text-muted-foreground">
          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
          {alreadyImported} MacroFactor {alreadyImported === 1 ? 'entry' : 'entries'} already imported. Re-uploading updates matching dates.
        </div>
      )}

      {/* ── Dropzone ── */}
      {(status === 'idle' || status === 'parsing' || status === 'error') && (
        <>
          <div
            onClick={() => status !== 'parsing' && inputRef.current?.click()}
            onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => {
              e.preventDefault()
              setDragging(false)
              const f = e.dataTransfer.files?.[0]
              if (f) handleFile(f)
            }}
            className={cn(
              'flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed p-8 text-center cursor-pointer transition-colors',
              dragging ? 'border-primary bg-primary/5' : 'border-border bg-card hover:border-primary/40',
              status === 'parsing' && 'pointer-events-none opacity-70'
            )}
          >
            {status === 'parsing' ? (
              <>
                <Loader2 className="h-8 w-8 text-primary animate-spin" />
                <p className="text-sm text-muted-foreground">Reading {fileName}...</p>
              </>
            ) : (
              <>
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/15">
                  <FileSpreadsheet className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <p className="text-sm font-medium text-foreground">Drop your MacroFactor export here</p>
                  <p className="text-xs text-muted-foreground mt-0.5">or tap to browse · .csv / .xlsx</p>
                </div>
              </>
            )}
            <input
              ref={inputRef}
              type="file"
              accept=".csv,.xlsx,.xls,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0]
                if (f) handleFile(f)
              }}
            />
          </div>

          {status === 'error' && error && (
            <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2.5">
              <AlertCircle className="h-4 w-4 text-destructive flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-sm text-destructive">{error}</p>
                <button onClick={reset} className="text-xs text-muted-foreground underline mt-1">Try another file</button>
              </div>
            </div>
          )}

          <div className="rounded-lg border border-border bg-card/50 p-3">
            <p className="text-xs font-medium text-foreground mb-1.5">How to export from MacroFactor</p>
            <ol className="text-xs text-muted-foreground leading-relaxed list-decimal list-inside space-y-0.5">
              <li>Open MacroFactor → Settings → Export Data</li>
              <li>Tap &quot;Export All&quot; to download the full history</li>
              <li>Upload the .csv (or .xlsx) file here</li>
            </ol>
            <p className="text-xs text-muted-foreground/70 mt-2 leading-relaxed">
              Captures calories, macros, fiber, water, caffeine, sodium, sugars, body weight, body-fat %, expenditure, and steps.
            </p>
          </div>
        </>
      )}

      {/* ── Preview ── */}
      {status === 'preview' && parsed && stats && (
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-3 gap-2">
            <StatCard label="Days" value={stats.days} icon={FileSpreadsheet} />
            <StatCard label="Nutrition" value={stats.withCalories} icon={Flame} />
            <StatCard label="Weigh-ins" value={stats.withWeight} icon={Scale} />
          </div>

          <div className="rounded-lg border border-border bg-card p-3">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Detected</p>
              <span className="text-xs text-muted-foreground">{stats.dateRange}</span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {parsed.detectedColumns.map((c) => (
                <span key={c} className="px-2 py-0.5 rounded-full bg-primary/15 text-primary text-xs font-medium capitalize">
                  {c}
                </span>
              ))}
            </div>
          </div>

          {/* Recent rows preview */}
          <div className="rounded-lg border border-border bg-card overflow-hidden">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide px-3 pt-3 pb-1.5">
              Preview (latest {Math.min(8, parsed.days.length)} days)
            </p>
            <div className="divide-y divide-border">
              {parsed.days.slice(-8).reverse().map((d) => (
                <div key={d.date} className="flex items-center justify-between px-3 py-2">
                  <span className="text-xs font-medium text-foreground">{d.date}</span>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    {d.calories !== undefined && <span className="flex items-center gap-1"><Flame className="h-3 w-3 text-orange-400" />{Math.round(d.calories)}</span>}
                    {d.protein !== undefined && <span className="flex items-center gap-1"><Beef className="h-3 w-3 text-red-400" />{Math.round(d.protein)}g</span>}
                    {d.carbs !== undefined && <span className="flex items-center gap-1"><Wheat className="h-3 w-3 text-amber-400" />{Math.round(d.carbs)}g</span>}
                    {d.fat !== undefined && <span className="flex items-center gap-1"><Droplet className="h-3 w-3 text-yellow-400" />{Math.round(d.fat)}g</span>}
                    {(d.trendWeightKg ?? d.weightKg) !== undefined && <span className="flex items-center gap-1"><Scale className="h-3 w-3 text-teal-400" />{(d.trendWeightKg ?? d.weightKg)}</span>}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="flex gap-2">
            <button onClick={reset} className="flex-1 rounded-xl border border-border bg-card py-3 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
              Cancel
            </button>
            <button onClick={handleSave} className="flex-[2] flex items-center justify-center gap-2 rounded-xl bg-primary py-3 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-colors">
              <Upload className="h-4 w-4" /> Import {stats.days} days
            </button>
          </div>
        </div>
      )}

      {/* ── Saving ── */}
      {status === 'saving' && (
        <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-border bg-card p-8">
          <Loader2 className="h-8 w-8 text-primary animate-spin" />
          <p className="text-sm text-muted-foreground">Saving to your timeline...</p>
        </div>
      )}

      {/* ── Done ── */}
      {status === 'done' && result && (
        <div className="flex flex-col gap-4">
          <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-6 text-center">
            <CheckCircle2 className="h-10 w-10 text-emerald-400" />
            <div>
              <p className="text-base font-semibold text-foreground">Import complete</p>
              <p className="text-sm text-muted-foreground mt-1">
                {result.mealsInserted} nutrition {result.mealsInserted === 1 ? 'day' : 'days'} and{' '}
                {result.weightsInserted} weigh-{result.weightsInserted === 1 ? 'in' : 'ins'} added
                {result.updated > 0 && `, ${result.updated} updated`}.
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={reset} className="flex-1 rounded-xl border border-border bg-card py-3 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
              Import another
            </button>
            <button onClick={() => router.push('/timeline')} className="flex-1 rounded-xl bg-primary py-3 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-colors">
              View timeline
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
