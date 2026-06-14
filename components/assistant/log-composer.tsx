'use client'

import { useRef, useState } from 'react'
import { Camera, Mic, Send, Square, AudioLines } from 'lucide-react'
import type { VoiceStatus } from '@/lib/hooks/use-voice-agent'

interface LogComposerProps {
  voiceActive: boolean
  status: VoiceStatus
  busy: boolean
  onStartVoice: () => void
  onStopVoice: () => void
  onSendText: (text: string) => void
  onSendImage: (file: File) => void
}

const STATUS_COPY: Partial<Record<VoiceStatus, string>> = {
  connecting: 'Connecting…',
  listening: 'Listening…',
  thinking: 'Thinking…',
  speaking: 'Speaking…',
}

/**
 * The input bar pinned to the bottom of the Talk page: snap a meal photo, type a
 * message, or start a hands-free voice conversation. Parsing, the chat transcript,
 * and the editable draft are owned by VoiceAssistant — this is input only.
 */
export function LogComposer({
  voiceActive,
  status,
  busy,
  onStartVoice,
  onStopVoice,
  onSendText,
  onSendImage,
}: LogComposerProps) {
  const [text, setText] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  function submit(e: React.FormEvent) {
    e.preventDefault()
    const t = text.trim()
    if (!t || busy) return
    setText('')
    onSendText(t)
  }

  return (
    <div className="border-t border-border bg-[var(--glass-bg)] px-4 py-3 backdrop-blur-xl">
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0]
          if (f) onSendImage(f)
          if (fileRef.current) fileRef.current.value = ''
        }}
      />

      {voiceActive ? (
        <div className="flex items-center justify-between gap-3 rounded-full border border-primary/40 bg-primary/10 px-4 py-2.5">
          <span className="flex items-center gap-2 text-sm font-medium text-primary">
            <AudioLines className="h-4 w-4 animate-pulse" /> {STATUS_COPY[status] ?? 'Listening…'}
          </span>
          <button
            onClick={onStopVoice}
            className="flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1.5 text-xs font-medium text-foreground transition-transform active:scale-95 hover:bg-secondary/60"
          >
            <Square className="h-3 w-3" /> End
          </button>
        </div>
      ) : (
        <form onSubmit={submit} className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={busy}
            aria-label="Log a meal photo"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-border bg-card text-muted-foreground transition-colors hover:text-foreground disabled:opacity-50"
          >
            <Camera className="h-5 w-5" />
          </button>
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            disabled={busy}
            placeholder="Log something or ask a question…"
            className="flex-1 rounded-full border border-border bg-background px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/50 disabled:opacity-60"
          />
          {text.trim() ? (
            <button
              type="submit"
              disabled={busy}
              aria-label="Send"
              className="glow flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground transition-transform active:scale-95 disabled:opacity-50"
            >
              <Send className="h-5 w-5" />
            </button>
          ) : (
            <button
              type="button"
              onClick={onStartVoice}
              aria-label="Start talking"
              className="orb-pulse flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground transition-transform active:scale-95"
            >
              <Mic className="h-5 w-5" />
            </button>
          )}
        </form>
      )}
    </div>
  )
}
