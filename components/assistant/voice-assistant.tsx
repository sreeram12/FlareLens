'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { Mic, MicOff, Sparkles, Check, Loader2, AlertTriangle, Info, Utensils, Activity, Camera } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useVoiceAgent } from '@/lib/hooks/use-voice-agent'
import { saveLogEntry } from '@/lib/actions'
import { LogEntryPreview } from '@/components/log/log-entry-preview'
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

export interface AssistantAlert {
  id: string | number
  severity: string
  title: string
  detail?: string | null
}

interface ParsedEntry {
  entryType: string
  data: Record<string, unknown>
  summary: string
}

const EXAMPLES = [
  { icon: Utensils, text: '“I had oatmeal and berries for breakfast”' },
  { icon: Activity, text: '“Cramping and a 4 out of 10 pain today”' },
  { icon: Sparkles, text: '“How has my trend been this week?”' },
  { icon: Camera, text: 'Snap a photo of your plate to log it' },
]

export function VoiceAssistant({ alerts = [] }: { alerts?: AssistantAlert[] }) {
  const { status, error, turns, muted, start, stop, toggleMute, pushTurn, patchTurn } = useVoiceAgent()
  const router = useRouter()
  const endRef = useRef<HTMLDivElement>(null)

  const [draft, setDraft] = useState<ParsedEntry | null>(null)
  const [imageUrl, setImageUrl] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const active = status !== 'idle' && status !== 'error'
  const hasTurns = turns.length > 0

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [turns, draft])

  function clearImage() {
    setImageUrl((p) => { if (p) URL.revokeObjectURL(p); return null })
  }

  async function handleSendText(text: string) {
    const history = turns
      .filter((t) => t.done && t.text)
      .map((t) => ({ role: t.role, text: t.text }))
    pushTurn('user', text)
    const aId = pushTurn('assistant', '', { done: false })
    setBusy(true)
    try {
      const res = await fetch('/api/talk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: [...history, { role: 'user', text }] }),
      })
      const data = await res.json()
      patchTurn(aId, { text: data.reply || 'Done.', done: true })
      if (data.draft) { clearImage(); setDraft(data.draft) }
    } catch {
      patchTurn(aId, { text: 'Sorry — something went wrong. Try again?', done: true })
    } finally {
      setBusy(false)
    }
  }

  async function handleSendImage(file: File) {
    pushTurn('user', '📷 Sent a meal photo')
    setImageUrl((p) => { if (p) URL.revokeObjectURL(p); return URL.createObjectURL(file) })
    const aId = pushTurn('assistant', '', { done: false })
    setBusy(true)
    const form = new FormData()
    form.append('image', file)
    try {
      const res = await fetch('/api/vision-meal', { method: 'POST', body: form })
      if (!res.ok) throw new Error()
      const parsed = (await res.json()) as ParsedEntry
      patchTurn(aId, { text: "Here's what I see on your plate — review the details and save.", done: true })
      setDraft(parsed)
    } catch {
      patchTurn(aId, { text: "I couldn't read that photo — want to try another?", done: true })
      clearImage()
    } finally {
      setBusy(false)
    }
  }

  async function saveDraft() {
    if (!draft) return
    setBusy(true)
    try {
      await saveLogEntry(draft.entryType, draft.data, undefined, imageUrl ? 'photo' : 'text')
      setDraft(null)
      clearImage()
      pushTurn('assistant', 'Saved to your timeline. ✓')
      router.refresh()
    } catch {
      pushTurn('assistant', 'That failed to save — want to try again?')
    } finally {
      setBusy(false)
    }
  }

  function discardDraft() {
    setDraft(null)
    clearImage()
    pushTurn('assistant', "Okay — I won't save that.")
  }

  return (
    <div className="flex h-[calc(100vh-5rem)] flex-col lg:h-[calc(100vh-2.5rem)]">
      {/* Header */}
      <header className="flex items-center justify-between px-4 pt-6 pb-2">
        <div className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/15">
            <Sparkles className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-base font-semibold leading-tight">Talk &amp; Log</h1>
            <p className="text-xs text-muted-foreground leading-tight">Say it, snap it, or type it — I&apos;ll track it</p>
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

      {/* Important info / alerts — surfaced at the top so nothing gets missed */}
      {alerts.length > 0 && (
        <div className="mx-4 mb-2 flex flex-col gap-1.5">
          {alerts.slice(0, 2).map((a) => {
            const urgent = a.severity === 'high' || a.severity === 'critical'
            return (
              <div
                key={a.id}
                className={cn(
                  'flex items-start gap-2 rounded-lg border px-3 py-2 text-xs',
                  urgent
                    ? 'border-red-500/40 bg-red-500/10 text-red-300'
                    : 'border-amber-500/30 bg-amber-500/10 text-amber-200/90'
                )}
              >
                {urgent ? <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" /> : <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />}
                <span>
                  <span className="font-semibold text-foreground">{a.title}</span>
                  {a.detail ? <span className="text-muted-foreground"> — {a.detail}</span> : null}
                </span>
              </div>
            )
          })}
        </div>
      )}

      {/* Conversation */}
      <Conversation className="flex-1">
        <ConversationContent className="px-4">
          {!hasTurns && !draft ? (
            <div className="flex flex-col items-center justify-center gap-5 py-8 text-center">
              <ConversationEmptyState
                icon={<Mic className="size-10 text-primary" />}
                title="What's this for?"
                description="This is your hands-free health journal. Just say how you're feeling, what you ate, or ask about your trends — FlareLens captures it, updates your stability score, and talks back. No forms."
              />
              <div className="flex w-full max-w-sm flex-col gap-2">
                <p className="label-mono text-muted-foreground/70">Try saying</p>
                {EXAMPLES.map(({ icon: Icon, text }) => (
                  <div
                    key={text}
                    className="flex items-center gap-2.5 rounded-lg border border-border bg-card/60 px-3 py-2 text-left text-sm text-muted-foreground"
                  >
                    <Icon className="h-4 w-4 shrink-0 text-primary/80" strokeWidth={1.9} />
                    <span>{text}</span>
                  </div>
                ))}
                <p className="mt-1 text-[11px] text-muted-foreground/60">
                  Tap the mic below to start, or type in the box. Everything stays private to you.
                </p>
              </div>
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

              {/* Editable draft — review & correct before it's saved */}
              {draft && (
                <div className="mt-2">
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
                  <LogEntryPreview parsed={draft} onChange={setDraft} onSave={saveDraft} onDiscard={discardDraft} />
                </div>
              )}

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
        busy={busy}
        onStartVoice={start}
        onStopVoice={stop}
        onSendText={handleSendText}
        onSendImage={handleSendImage}
      />
    </div>
  )
}
