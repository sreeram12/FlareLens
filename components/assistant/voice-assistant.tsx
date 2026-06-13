'use client'

import { useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Mic, MicOff, Sparkles, Check, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useVoiceAgent } from '@/lib/hooks/use-voice-agent'
import {
  Conversation,
  ConversationContent,
  ConversationEmptyState,
  ConversationScrollButton,
} from '@/components/ai-elements/conversation'
import { Message, MessageContent } from '@/components/ai-elements/message'
import { LogComposer } from './log-composer'

const TOOL_LABELS: Record<string, string> = {
  log_health_entry: 'Logged to your timeline',
  get_today_status: "Checked today's status",
  get_recent_activity: 'Reviewed recent activity',
  get_trend: 'Analyzed your trend',
  get_diet_guidance: 'Checked your diet phase',
  get_flare_fingerprint: 'Compared to your flare fingerprint',
  get_signals: 'Reviewed your latest signals',
}

export function VoiceAssistant() {
  const { status, error, turns, muted, start, stop, toggleMute } = useVoiceAgent()
  const router = useRouter()
  const endRef = useRef<HTMLDivElement>(null)

  const active = status !== 'idle' && status !== 'error'
  const hasTurns = turns.length > 0

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [turns])

  return (
    <div className="flex h-[calc(100vh-5rem)] flex-col lg:h-[calc(100vh-2.5rem)]">
      {/* Header */}
      <header className="flex items-center justify-between px-4 pt-6 pb-2">
        <div className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/15">
            <Sparkles className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-base font-semibold leading-tight">FlareLens</h1>
            <p className="text-xs text-muted-foreground leading-tight">Voice companion · powered by Grok</p>
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
                title="Talk, type, or snap a meal"
                description="Tell me how you're feeling, log a meal by photo, or ask about your trends. I'll capture it, keep your score current, and talk back."
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

      {/* Unified composer: voice · photo · typed */}
      <LogComposer
        voiceActive={active}
        status={status}
        onStartVoice={start}
        onStopVoice={stop}
        onLogged={() => router.refresh()}
      />
    </div>
  )
}
