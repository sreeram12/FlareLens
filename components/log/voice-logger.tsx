'use client'

import { useState, useRef, useCallback } from 'react'
import { Mic, MicOff, Loader2, CheckCircle2, RefreshCw, Send } from 'lucide-react'
import { cn } from '@/lib/utils'
import { saveLogEntry } from '@/lib/actions'
import { LogEntryPreview } from './log-entry-preview'
import { ManualLogForm } from './manual-log-form'

type Stage = 'idle' | 'recording' | 'transcribing' | 'parsing' | 'preview' | 'saving' | 'saved' | 'error'

interface ParsedEntry {
  entryType: string
  data: Record<string, unknown>
  summary: string
}

export function VoiceLogger() {
  const [stage, setStage] = useState<Stage>('idle')
  const [transcript, setTranscript] = useState('')
  const [parsed, setParsed] = useState<ParsedEntry | null>(null)
  const [errorMsg, setErrorMsg] = useState('')
  const [showManual, setShowManual] = useState(false)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])

  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const mr = new MediaRecorder(stream, { mimeType: 'audio/webm' })
      chunksRef.current = []
      mr.ondataavailable = e => { if (e.data.size > 0) chunksRef.current.push(e.data) }
      mr.onstop = () => { stream.getTracks().forEach(t => t.stop()) }
      mr.start()
      mediaRecorderRef.current = mr
      setStage('recording')
    } catch {
      setErrorMsg('Microphone access denied. Use manual entry below.')
      setStage('error')
    }
  }, [])

  const stopRecording = useCallback(() => {
    if (!mediaRecorderRef.current) return
    setStage('transcribing')
    mediaRecorderRef.current.onstop = async () => {
      const blob = new Blob(chunksRef.current, { type: 'audio/webm' })
      const formData = new FormData()
      formData.append('audio', blob, 'recording.webm')
      try {
        const res = await fetch('/api/transcribe', { method: 'POST', body: formData })
        if (!res.ok) throw new Error('Transcription failed')
        const { text } = await res.json()
        setTranscript(text)
        await parseTranscript(text)
      } catch (e) {
        setErrorMsg('Transcription failed. Try manual entry or type below.')
        setStage('error')
      }
    }
    mediaRecorderRef.current.stop()
  }, [])

  async function parseTranscript(text: string) {
    setStage('parsing')
    try {
      const res = await fetch('/api/parse-log', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transcript: text }),
      })
      if (!res.ok) throw new Error('Parsing failed')
      const result = await res.json()
      setParsed(result)
      setStage('preview')
    } catch {
      setErrorMsg('Could not parse your log. Please review and edit manually.')
      setStage('error')
    }
  }

  async function handleSave() {
    if (!parsed) return
    setStage('saving')
    try {
      await saveLogEntry(parsed.entryType, parsed.data, transcript, 'voice')
      setStage('saved')
      setTimeout(reset, 2500)
    } catch {
      setErrorMsg('Failed to save. Please try again.')
      setStage('error')
    }
  }

  function reset() {
    setStage('idle')
    setTranscript('')
    setParsed(null)
    setErrorMsg('')
  }

  if (showManual) {
    return (
      <div>
        <button
          onClick={() => setShowManual(false)}
          className="text-xs text-primary mb-4 flex items-center gap-1 hover:underline"
        >
          ← Back to Voice Log
        </button>
        <ManualLogForm onSaved={reset} />
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Main recorder */}
      <div className="rounded-2xl border border-border bg-card p-6 flex flex-col items-center gap-5">
        {stage === 'idle' && (
          <>
            <div className="text-center">
              <p className="text-sm text-muted-foreground leading-relaxed">
                Tap the mic and speak naturally.<br />
                <span className="text-xs">"I had 3 BMs this morning, pain around a 4..."</span>
              </p>
            </div>
            <button
              onClick={startRecording}
              className="h-20 w-20 rounded-full bg-primary/10 border-2 border-primary/50 flex items-center justify-center hover:bg-primary/20 hover:border-primary transition-all active:scale-95"
            >
              <Mic className="h-8 w-8 text-primary" strokeWidth={2} />
            </button>
          </>
        )}

        {stage === 'recording' && (
          <>
            <div className="text-center">
              <p className="text-sm font-semibold text-red-400 animate-pulse">Recording…</p>
              <p className="text-xs text-muted-foreground mt-1">Tap to stop when done</p>
            </div>
            <button
              onClick={stopRecording}
              className="h-20 w-20 rounded-full bg-red-500/10 border-2 border-red-400 flex items-center justify-center hover:bg-red-500/20 transition-all active:scale-95 animate-pulse"
            >
              <MicOff className="h-8 w-8 text-red-400" strokeWidth={2} />
            </button>
          </>
        )}

        {(stage === 'transcribing' || stage === 'parsing') && (
          <div className="flex flex-col items-center gap-3 py-4">
            <Loader2 className="h-8 w-8 text-primary animate-spin" />
            <p className="text-sm text-muted-foreground">
              {stage === 'transcribing' ? 'Transcribing audio…' : 'Extracting health data…'}
            </p>
          </div>
        )}

        {stage === 'saved' && (
          <div className="flex flex-col items-center gap-3 py-4">
            <CheckCircle2 className="h-10 w-10 text-emerald-400" />
            <p className="text-sm font-semibold text-emerald-400">Entry saved!</p>
          </div>
        )}

        {stage === 'saving' && (
          <div className="flex flex-col items-center gap-3 py-4">
            <Loader2 className="h-8 w-8 text-primary animate-spin" />
            <p className="text-sm text-muted-foreground">Saving entry…</p>
          </div>
        )}

        {stage === 'error' && (
          <div className="w-full flex flex-col gap-3">
            <p className="text-sm text-red-400 text-center">{errorMsg}</p>
            <div className="flex gap-2 justify-center">
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

      {/* Transcript */}
      {transcript && stage === 'preview' && (
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">Transcript</p>
          <p className="text-sm text-foreground leading-relaxed italic">&ldquo;{transcript}&rdquo;</p>
        </div>
      )}

      {/* Parsed preview */}
      {stage === 'preview' && parsed && (
        <LogEntryPreview
          parsed={parsed}
          onChange={setParsed}
          onSave={handleSave}
          onDiscard={reset}
        />
      )}

      {/* Type instead */}
      {stage === 'idle' && (
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-3">
            Or type your log
          </p>
          <TypeTranscript onSubmit={parseTranscript} />
        </div>
      )}

      {/* Manual form link */}
      <button
        onClick={() => setShowManual(true)}
        className="text-xs text-muted-foreground hover:text-foreground text-center transition-colors underline underline-offset-2"
      >
        Use structured manual entry instead
      </button>
    </div>
  )
}

function TypeTranscript({ onSubmit }: { onSubmit: (text: string) => void }) {
  const [value, setValue] = useState('')
  return (
    <form
      onSubmit={e => {
        e.preventDefault()
        if (value.trim()) onSubmit(value.trim())
      }}
      className="flex flex-col gap-2"
    >
      <textarea
        value={value}
        onChange={e => setValue(e.target.value)}
        placeholder="e.g. had 3 BMs this morning, pain is about a 4, feeling tired..."
        className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground resize-none h-20 focus:outline-none focus:ring-1 focus:ring-primary/50"
      />
      <button
        type="submit"
        disabled={!value.trim()}
        className="flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-40 hover:bg-primary/90 transition-colors"
      >
        <Send className="h-3.5 w-3.5" />
        Parse &amp; Review
      </button>
    </form>
  )
}
