'use client'

import { useRef, useState } from 'react'
import { Camera, Loader2, CheckCircle2, RefreshCw } from 'lucide-react'
import Image from 'next/image'
import { saveLogEntry } from '@/lib/actions'
import { LogEntryPreview } from './log-entry-preview'

type Stage = 'idle' | 'analyzing' | 'preview' | 'saving' | 'saved' | 'error'

interface ParsedEntry {
  entryType: string
  data: Record<string, unknown>
  summary: string
}

/**
 * Photo meal logging: snap/upload a meal photo → Grok vision extracts an
 * anti-inflammatory-diet-aware meal → the SAME editable preview lets the user
 * correct it → save. Voice's sibling; both feed one meal model.
 */
export function PhotoLogger() {
  const [stage, setStage] = useState<Stage>('idle')
  const [parsed, setParsed] = useState<ParsedEntry | null>(null)
  const [imageUrl, setImageUrl] = useState<string | null>(null)
  const [errorMsg, setErrorMsg] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  async function handleFile(file: File) {
    setImageUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev)
      return URL.createObjectURL(file)
    })
    setStage('analyzing')
    const form = new FormData()
    form.append('image', file)
    try {
      const res = await fetch('/api/vision-meal', { method: 'POST', body: form })
      if (!res.ok) throw new Error('vision failed')
      const result = (await res.json()) as ParsedEntry
      setParsed(result)
      setStage('preview')
    } catch {
      setErrorMsg('Could not read the meal from that photo. Try another shot or log by voice.')
      setStage('error')
    }
  }

  async function handleSave() {
    if (!parsed) return
    setStage('saving')
    try {
      await saveLogEntry(parsed.entryType, parsed.data, undefined, 'photo')
      setStage('saved')
      setTimeout(reset, 2500)
    } catch {
      setErrorMsg('Failed to save. Please try again.')
      setStage('error')
    }
  }

  function reset() {
    setStage('idle')
    setParsed(null)
    setErrorMsg('')
    setImageUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev)
      return null
    })
    if (fileRef.current) fileRef.current.value = ''
  }

  return (
    <div className="flex flex-col gap-4">
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0]
          if (f) handleFile(f)
        }}
      />

      <div className="rounded-2xl border border-border bg-card p-6 flex flex-col items-center gap-5">
        {stage === 'idle' && (
          <>
            <div className="text-center">
              <p className="text-sm text-muted-foreground leading-relaxed">
                Snap or upload a photo of your meal.
                <br />
                <span className="text-xs">FlareLens estimates the foods and how anti-inflammatory it is.</span>
              </p>
            </div>
            <button
              onClick={() => fileRef.current?.click()}
              className="glow h-20 w-20 rounded-full bg-primary/10 border-2 border-primary/50 flex items-center justify-center hover:bg-primary/20 hover:border-primary transition-all active:scale-95"
            >
              <Camera className="h-8 w-8 text-primary text-glow" strokeWidth={2} />
            </button>
          </>
        )}

        {(stage === 'analyzing' || stage === 'saving') && (
          <div className="flex flex-col items-center gap-3 py-2">
            {imageUrl && (
              <Image
                src={imageUrl}
                alt="Meal"
                width={120}
                height={120}
                unoptimized
                className="h-28 w-28 rounded-xl object-cover border border-border"
              />
            )}
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 text-primary animate-spin" />
              {stage === 'analyzing' ? 'Reading your meal…' : 'Saving entry…'}
            </div>
          </div>
        )}

        {stage === 'saved' && (
          <div className="flex flex-col items-center gap-3 py-4">
            <CheckCircle2 className="h-10 w-10 text-emerald-400" />
            <p className="text-sm font-semibold text-emerald-400">Meal saved!</p>
          </div>
        )}

        {stage === 'error' && (
          <div className="w-full flex flex-col gap-3">
            <p className="text-sm text-red-400 text-center">{errorMsg}</p>
            <div className="flex justify-center">
              <button
                onClick={reset}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-card border border-border text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                Try again
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Extracted meal with the photo thumbnail, fully editable before save */}
      {stage === 'preview' && parsed && (
        <>
          {imageUrl && (
            <Image
              src={imageUrl}
              alt="Meal"
              width={400}
              height={160}
              unoptimized
              className="w-full h-40 rounded-xl object-cover border border-border"
            />
          )}
          <LogEntryPreview parsed={parsed} onChange={setParsed} onSave={handleSave} onDiscard={reset} />
        </>
      )}
    </div>
  )
}
