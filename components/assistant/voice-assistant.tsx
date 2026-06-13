'use client'

import { useEffect, useRef, useState } from 'react'
import { useChat } from '@ai-sdk/react'
import { DefaultChatTransport } from 'ai'
import { Mic, Square, Volume2, VolumeX, Send, Sparkles, Check, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useSpeechRecognition, useSpeechSynthesis } from '@/lib/hooks/use-speech'
import {
  Conversation,
  ConversationContent,
  ConversationEmptyState,
  ConversationScrollButton,
} from '@/components/ai-elements/conversation'
import { Message, MessageContent } from '@/components/ai-elements/message'

const SUGGESTIONS = [
  'I had 3 loose bowel movements this morning',
  'How is my week looking?',
  'Logged 7 hours of sleep, felt rested',
  'What might have triggered my flare?',
]

function getMessageText(parts: any[]): string {
  return parts
    .filter((p) => p.type === 'text')
    .map((p) => p.text)
    .join('')
}

function ToolIndicator({ part }: { part: any }) {
  const toolLabels: Record<string, string> = {
    'tool-logHealthEntry': 'Logging entry',
    'tool-getTodayStatus': 'Checking today',
    'tool-getRecentActivity': 'Reviewing recent activity',
    'tool-getTrend': 'Analyzing your trend',
  }
  const label = toolLabels[part.type] ?? 'Working'
  const done = part.state === 'output-available'
  const logged =
    part.type === 'tool-logHealthEntry' && done ? (part.output?.summary as string) : null

  return (
    <div className="flex items-center gap-2 rounded-lg border border-border bg-secondary/40 px-3 py-2 text-xs text-muted-foreground">
      {done ? (
        <Check className="h-3.5 w-3.5 text-[oklch(0.68_0.16_160)]" />
      ) : (
        <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
      )}
      <span>{logged ? `Logged: ${logged}` : `${label}…`}</span>
    </div>
  )
}

export function VoiceAssistant() {
  const [input, setInput] = useState('')
  const [voiceReplies, setVoiceReplies] = useState(true)
  const spokenIdsRef = useRef<Set<string>>(new Set())

  const { messages, sendMessage, status, error } = useChat({
    transport: new DefaultChatTransport({ api: '/api/chat' }),
  })

  const synthesis = useSpeechSynthesis()
  const recognition = useSpeechRecognition((text) => {
    if (text.trim()) {
      synthesis.cancel()
      sendMessage({ text })
    }
  })

  const isBusy = status === 'submitted' || status === 'streaming'

  // Speak completed assistant messages aloud
  useEffect(() => {
    if (!voiceReplies || status !== 'ready') return
    const last = messages[messages.length - 1]
    if (!last || last.role !== 'assistant') return
    if (spokenIdsRef.current.has(last.id)) return
    const text = getMessageText(last.parts)
    if (text) {
      spokenIdsRef.current.add(last.id)
      synthesis.speak(text)
    }
  }, [messages, status, voiceReplies, synthesis])

  const handleSend = (text: string) => {
    if (!text.trim()) return
    synthesis.cancel()
    sendMessage({ text })
    setInput('')
  }

  const handleMicTap = () => {
    if (recognition.listening) {
      recognition.stop()
    } else {
      synthesis.cancel()
      recognition.start()
    }
  }

  const hasMessages = messages.length > 0

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
            <p className="text-xs text-muted-foreground leading-tight">Your health companion</p>
          </div>
        </div>
        {synthesis.supported && (
          <button
            onClick={() => {
              if (voiceReplies) synthesis.cancel()
              setVoiceReplies((v) => !v)
            }}
            aria-label={voiceReplies ? 'Mute spoken replies' : 'Enable spoken replies'}
            className={cn(
              'flex h-9 w-9 items-center justify-center rounded-xl border border-border transition-colors',
              voiceReplies ? 'bg-primary/15 text-primary' : 'text-muted-foreground'
            )}
          >
            {voiceReplies ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
          </button>
        )}
      </header>

      {/* Conversation */}
      <Conversation className="flex-1">
        <ConversationContent className="px-4">
          {!hasMessages ? (
            <div className="flex flex-col items-center justify-center gap-6 py-8 text-center">
              <ConversationEmptyState
                icon={<Mic className="size-10 text-primary" />}
                title="Talk to me about your day"
                description="Tap the mic and tell me how you're feeling, what you ate, or ask about your trends. I'll log it and keep your score up to date."
              />
              <div className="flex flex-col gap-2 w-full max-w-sm">
                {SUGGESTIONS.map((s) => (
                  <button
                    key={s}
                    onClick={() => handleSend(s)}
                    className="rounded-xl border border-border bg-card px-4 py-2.5 text-left text-sm text-card-foreground transition-colors hover:bg-secondary/60"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            messages.map((message) => (
              <Message from={message.role} key={message.id}>
                <MessageContent>
                  {message.parts.map((part, i) => {
                    if (part.type === 'text') {
                      return <span key={`${message.id}-${i}`}>{part.text}</span>
                    }
                    if (typeof part.type === 'string' && part.type.startsWith('tool-')) {
                      return <ToolIndicator key={`${message.id}-${i}`} part={part} />
                    }
                    return null
                  })}
                </MessageContent>
              </Message>
            ))
          )}
        </ConversationContent>
        <ConversationScrollButton />
      </Conversation>

      {error && (
        <div className="mx-4 mb-2 rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
          {error.message || 'Something went wrong reaching the assistant.'}
        </div>
      )}

      {/* Voice control dock */}
      <div className="border-t border-border bg-card/95 px-4 py-4 backdrop-blur-sm">
        {/* Live transcript / status line */}
        <div className="mb-3 flex min-h-5 items-center justify-center text-center text-sm">
          {recognition.listening ? (
            <span className="text-primary">
              {recognition.interimText || 'Listening…'}
            </span>
          ) : synthesis.speaking ? (
            <span className="flex items-center gap-1.5 text-accent">
              <Volume2 className="h-3.5 w-3.5" /> Speaking…
            </span>
          ) : isBusy ? (
            <span className="flex items-center gap-1.5 text-muted-foreground">
              <Loader2 className="h-3.5 w-3.5 animate-spin" /> Thinking…
            </span>
          ) : (
            <span className="text-muted-foreground">Tap to speak</span>
          )}
        </div>

        <div className="flex items-center justify-center gap-3">
          {/* Text fallback input */}
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleSend(input)
            }}
            placeholder="Or type here…"
            className="h-11 flex-1 rounded-full border border-border bg-secondary/40 px-4 text-sm text-foreground outline-none placeholder:text-muted-foreground focus:border-primary/50"
          />

          {input.trim() ? (
            <button
              onClick={() => handleSend(input)}
              aria-label="Send message"
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground transition-transform active:scale-95"
            >
              <Send className="h-5 w-5" />
            </button>
          ) : recognition.supported ? (
            <button
              onClick={handleMicTap}
              aria-label={recognition.listening ? 'Stop listening' : 'Start voice input'}
              className={cn(
                'relative flex h-14 w-14 shrink-0 items-center justify-center rounded-full text-primary-foreground transition-all active:scale-95',
                recognition.listening
                  ? 'bg-destructive shadow-[0_0_0_6px_oklch(0.60_0.22_25/0.2)]'
                  : 'bg-primary shadow-[0_0_0_4px_oklch(0.62_0.2_250/0.18)]'
              )}
            >
              {recognition.listening && (
                <span className="absolute inset-0 animate-ping rounded-full bg-destructive/40" />
              )}
              {recognition.listening ? (
                <Square className="relative h-5 w-5 fill-current" />
              ) : (
                <Mic className="relative h-6 w-6" />
              )}
            </button>
          ) : (
            <button
              onClick={() => handleSend(input)}
              aria-label="Send message"
              disabled={!input.trim()}
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground disabled:opacity-40"
            >
              <Send className="h-5 w-5" />
            </button>
          )}
        </div>

        {!recognition.supported && (
          <p className="mt-2 text-center text-xs text-muted-foreground">
            Voice input needs Chrome or Edge. You can type instead.
          </p>
        )}
      </div>
    </div>
  )
}
