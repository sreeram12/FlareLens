'use client'

import { useEffect, useRef } from 'react'
import { Mic, MicOff, PhoneOff, Sparkles, Check, Loader2, AudioLines } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useVoiceAgent, type VoiceStatus } from '@/lib/hooks/use-voice-agent'
import {
  Conversation,
  ConversationContent,
  ConversationEmptyState,
  ConversationScrollButton,
} from '@/components/ai-elements/conversation'
import { Message, MessageContent } from '@/components/ai-elements/message'

const TOOL_LABELS: Record<string, string> = {
  log_health_entry: 'Logged to your timeline',
  get_today_status: "Checked today's status",
  get_recent_activity: 'Reviewed recent activity',
  get_trend: 'Analyzed your trend',
}

const STATUS_COPY: Record<VoiceStatus, string> = {
  idle: 'Tap to start talking',
  connecting: 'Connecting…',
  listening: 'Listening…',
  thinking: 'Thinking…',
  speaking: 'Speaking…',
  error: 'Something went wrong',
}

function StatusLine({ status }: { status: VoiceStatus }) {
  return (
    <div className="flex min-h-5 items-center justify-center gap-1.5 text-center text-sm">
      {status === 'listening' && (
        <span className="flex items-center gap-1.5 text-primary">
          <AudioLines className="h-4 w-4 animate-pulse" /> {STATUS_COPY.listening}
        </span>
      )}
      {status === 'speaking' && (
        <span className="flex items-center gap-1.5 text-accent">
          <AudioLines className="h-4 w-4 animate-pulse" /> {STATUS_COPY.speaking}
        </span>
      )}
      {(status === 'thinking' || status === 'connecting') && (
        <span className="flex items-center gap-1.5 text-muted-foreground">
          <Loader2 className="h-3.5 w-3.5 animate-spin" /> {STATUS_COPY[status]}
        </span>
      )}
      {(status === 'idle' || status === 'error') && (
        <span className="text-muted-foreground">{STATUS_COPY[status]}</span>
      )}
    </div>
  )
}

export function VoiceAssistant() {
  const { status, error, turns, muted, start, stop, toggleMute } = useVoiceAgent()
  const endRef = useRef<HTMLDivElement>(null)

  const active = status !== 'idle' && status !== 'error'
  const hasTurns = turns.length > 0

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [turns])

  return (
    <div className="flex h-[calc(100vh-5rem)] flex-col">
      {/* Header */}
      <header className="flex items-center justify-between px-4 pt-6 pb-2">
        <div className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/15">
            <Sparkles className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-base font-semibold leading-tight">FlareLens</h1>
            <p className="text-xs text-muted-foreground leading-tight">
              Voice companion · powered by Grok
            </p>
          </div>
        </div>
        {active && (
          <button
            onClick={toggleMute}
            aria-label={muted ? 'Unmute microphone' : 'Mute microphone'}
            className={cn(
              'flex h-9 w-9 items-center justify-center rounded-xl border border-border transition-colors',
              muted ? 'bg-destructive/15 text-destructive' : 'bg-primary/15 text-primary'
            )}
          >
            {muted ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
          </button>
        )}
      </header>

      {/* Conversation */}
      <Conversation className="flex-1">
        <ConversationContent className="px-4">
          {!hasTurns ? (
            <div className="flex flex-col items-center justify-center gap-6 py-10 text-center">
              <ConversationEmptyState
                icon={<Mic className="size-10 text-primary" />}
                title="Just start talking"
                description="Tell me how you're feeling, what you ate, or ask about your trends. I'll listen, log it, keep your score current, and talk back."
              />
            </div>
          ) : (
            <>
              {turns.map((turn) => (
                <Message from={turn.role} key={turn.id}>
                  <MessageContent>
                    {turn.text ? (
                      <span>{turn.text}</span>
                    ) : !turn.done ? (
                      <span className="inline-flex items-center gap-1.5 text-muted-foreground">
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        {turn.role === 'user' ? 'Transcribing…' : 'Thinking…'}
                      </span>
                    ) : null}
                    {turn.tool && (
                      <span className="mt-2 flex items-center gap-2 rounded-lg border border-border bg-secondary/40 px-3 py-1.5 text-xs text-muted-foreground">
                        <Check className="h-3.5 w-3.5 text-[oklch(0.68_0.16_160)]" />
                        {TOOL_LABELS[turn.tool] ?? 'Done'}
                      </span>
                    )}
                  </MessageContent>
                </Message>
              ))}
              <div ref={endRef} />
            </>
          )}
        </ConversationContent>
        <ConversationScrollButton />
      </Conversation>

      {error && (
        <div className="mx-4 mb-2 rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
          {error}
        </div>
      )}

      {/* Voice control dock */}
      <div className="border-t border-border bg-card/95 px-4 py-5 backdrop-blur-sm">
        <div className="mb-4">
          <StatusLine status={status} />
        </div>

        <div className="flex items-center justify-center">
          {!active ? (
            <button
              onClick={start}
              aria-label="Start voice conversation"
              className="relative flex h-20 w-20 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-[0_0_0_6px_oklch(0.62_0.2_250/0.16)] transition-transform active:scale-95"
            >
              <Mic className="h-8 w-8" />
            </button>
          ) : (
            <div className="flex flex-col items-center gap-3">
              <div
                className={cn(
                  'relative flex h-20 w-20 items-center justify-center rounded-full transition-all',
                  status === 'listening' && 'bg-primary text-primary-foreground',
                  status === 'speaking' && 'bg-accent text-accent-foreground',
                  (status === 'thinking' || status === 'connecting') &&
                    'bg-secondary text-secondary-foreground'
                )}
              >
                {(status === 'listening' || status === 'speaking') && (
                  <span
                    className={cn(
                      'absolute inset-0 animate-ping rounded-full',
                      status === 'listening' ? 'bg-primary/30' : 'bg-accent/30'
                    )}
                  />
                )}
                <AudioLines className="relative h-8 w-8" />
              </div>
              <button
                onClick={stop}
                aria-label="End voice conversation"
                className="flex items-center gap-2 rounded-full bg-destructive px-4 py-2 text-sm font-medium text-destructive-foreground transition-transform active:scale-95"
              >
                <PhoneOff className="h-4 w-4" /> End
              </button>
            </div>
          )}
        </div>

        {!active && (
          <p className="mt-4 text-center text-xs text-muted-foreground">
            {status === 'error'
              ? 'Tap the mic to try again.'
              : 'A natural, hands-free conversation. Best in Chrome or Edge.'}
          </p>
        )}
      </div>
    </div>
  )
}
