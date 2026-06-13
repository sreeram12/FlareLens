'use client'

import { useRef, useState } from 'react'
import Image from 'next/image'
import { Camera, Mic, Send, Loader2, Square, AudioLines } from 'lucide-react'
import { saveLogEntry } from '@/lib/actions'
import { LogEntryPreview } from '@/components/log/log-entry-preview'
import type { VoiceStatus } from '@/lib/hooks/use-voice-agent'

interface ParsedEntry {
  entryType: string
  data: Record<string, unknown>
  summary: string
}
type Stage = 'idle' | 'parsing' | 'preview' | 'saving'

interface LogComposerProps {
  voiceActive: boolean
  status: VoiceStatus
  onStartVoice: () => void
  onStopVoice: () => void
  onLogged?: () => void
}

const STATUS_COPY: Partial<Record<VoiceStatus, string>> = {
  connecting: 'Connecting…',
  listening: 'Listening…',
  thinking: 'Thinking…',
  speaking: 'Speaking…',
}

/**
 * One front door for logging, pinned to the bottom of the Talk page: snap a meal
 * photo, type a quick log, or start a hands-free voice conversation. Typed/photo
 * logs run through the editable preview before saving; voice delegates to the
 * realtime agent.
 */
export function LogComposer({ voiceActive, status, onStartVoice, onStopVoice, onLogged }: LogComposerProps) {
  const [text, setText] = useState('')
  const [stage, setStage] = useState<Stage>('idle')
  const [parsed, setParsed] = useState<ParsedEntry | null>(null)
  const [imageUrl, setImageUrl] = useState<string | null>(null)
  const [error, setError] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  function clearImage() {
    setImageUrl((p) => { if (p) URL.revokeObjectURL(p); return null })
  }
  function reset() {
    setStage('idle'); setParsed(null); clearImage()
    if (fileRef.current) fileRef.current.value = ''
  }

  async function submitText(e: React.FormEvent) {
    e.preventDefault()
    const t = text.trim()
    if (!t) return
    setText(''); setError(''); clearImage(); setStage('parsing')
    try {
      const res = await fetch('/api/parse-log', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transcript: t }),
      })
      if (!res.ok) throw new Error()
      setParsed(await res.json())
      setStage('preview')
    } catch {
      setError('Could not read that — try again or use manual entry.')
      setStage('idle')
    }
  }

  async function handleFile(file: File) {
    setError('')
    setImageUrl((p) => { if (p) URL.revokeObjectURL(p); return URL.createObjectURL(file) })
    setStage('parsing')
    const form = new FormData()
    form.append('image', file)
    try {
      const res = await fetch('/api/vision-meal', { method: 'POST', body: form })
      if (!res.ok) throw new Error()
      setParsed(await res.json())
      setStage('preview')
    } catch {
      setError('Could not read that photo — try again.')
      setStage('idle')
      clearImage()
    }
  }

  async function save() {
    if (!parsed) return
    setStage('saving')
    try {
      await saveLogEntry(parsed.entryType, parsed.data, undefined, imageUrl ? 'photo' : 'text')
      reset()
      onLogged?.()
    } catch {
      setError('Failed to save — try again.')
      setStage('preview')
    }
  }

  return (
    <div className="border-t border-border bg-[var(--glass-bg)] px-4 py-3 backdrop-blur-xl">
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f) }}
      />

      {error && <p className="mb-2 text-xs text-destructive">{error}</p>}

      {stage === 'parsing' && (
        <div className="mb-3 flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin text-primary" /> Reading your log…
        </div>
      )}

      {(stage === 'preview' || stage === 'saving') && parsed && (
        <div className="mb-3">
          {imageUrl && (
            <Image
              src={imageUrl}
              alt="Meal"
              width={400}
              height={140}
              unoptimized
              className="mb-2 h-32 w-full rounded-xl border border-border object-cover"
            />
          )}
          <LogEntryPreview parsed={parsed} onChange={setParsed} onSave={save} onDiscard={reset} />
        </div>
      )}

      {voiceActive ? (
        <div className="flex items-center justify-between gap-3 rounded-full border border-primary/40 bg-primary/10 px-4 py-2.5">
          <span className="flex items-center gap-2 text-sm font-medium text-primary">
            <AudioLines className="h-4 w-4 animate-pulse" /> {STATUS_COPY[status] ?? 'Listening…'}
          </span>
          <button
            onClick={onStopVoice}
            className="flex items-center gap-1.5 rounded-full bg-destructive px-3 py-1.5 text-xs font-medium text-destructive-foreground transition-transform active:scale-95"
          >
            <Square className="h-3 w-3" /> End
          </button>
        </div>
      ) : (
        <form onSubmit={submitText} className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            aria-label="Log a meal photo"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-border bg-card text-muted-foreground transition-colors hover:text-foreground"
          >
            <Camera className="h-5 w-5" />
          </button>
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Log something or ask a question…"
            className="flex-1 rounded-full border border-border bg-background px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/50"
          />
          {text.trim() ? (
            <button
              type="submit"
              aria-label="Send"
              className="glow flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground transition-transform active:scale-95"
            >
              <Send className="h-5 w-5" />
            </button>
          ) : (
            <button
              type="button"
              onClick={onStartVoice}
              aria-label="Start talking"
              className="glow flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground transition-transform active:scale-95"
            >
              <Mic className="h-5 w-5" />
            </button>
          )}
        </form>
      )}
    </div>
  )
}
