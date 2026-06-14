'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  voiceGetTodayStatus,
  voiceGetRecentActivity,
  voiceGetTrend,
  voiceGetDietGuidance,
  voiceGetFlareFingerprint,
  voiceGetSignals,
  voiceGetLabs,
  voiceGetFoodExerciseTrends,
} from '@/lib/voice-tools'
import { AID_AI_GUIDANCE } from '@/lib/ibd-aid'
import { FLARE_AI_GUIDANCE } from '@/lib/flare-fingerprint'
import { ANALYST_AI_GUIDANCE } from '@/lib/findings'

export type VoiceStatus = 'idle' | 'connecting' | 'listening' | 'thinking' | 'speaking' | 'error'

export interface TranscriptTurn {
  id: string
  role: 'user' | 'assistant'
  text: string
  done: boolean
  tool?: string
}

const SAMPLE_RATE = 24000

const SESSION_INSTRUCTIONS = `You are FlareLens, a warm, attentive AI health companion for someone managing Crohn's disease. You speak with the user out loud, so keep replies natural, concise, and easy to listen to — usually 1-3 short sentences.

Your job:
- LOG health events the user describes (bowel movements, symptoms, meals, medications, sleep, exercise). But DON'T log on the first mention. First ask one or two brief, natural follow-up questions to capture the key details — meal: what was in it and portion; symptom: how severe (0-10); exercise: type, duration, intensity; bowel movement: count, urgency, any blood; medication: which one and whether taken. Keep it conversational. Once you have enough and the user seems done describing it, ASK "Want me to log this?" Only AFTER they say yes, call the log_health_entry function. Calling it puts a pre-filled review card on their screen — so tell them you've added it for review and they can tweak and save it. Do NOT claim it's already saved.
- ANSWER questions about their health using the data tools. Be specific and reference real numbers:
  • get_today_status / get_recent_activity / get_trend for today, recent entries, and the stability-score history.
  • get_labs for lab results from their medical records (CRP, fecal calprotectin, ferritin, hemoglobin, etc.) — use this for ANY question about labs, inflammation markers, or bloodwork; cite the value, whether it's high/low, and the direction.
  • get_food_exercise_trends for how their meals (anti-inflammatory balance, trigger foods) and exercise have been trending — use this for "how's my diet/eating been", "am I exercising enough", or meal/movement pattern questions.
  • get_diet_guidance before giving food advice; get_flare_fingerprint for "why do I feel worse"; get_signals for anything urgent.
- ENCOURAGE and reassure. You are supportive but never give definitive medical diagnoses. If something sounds serious (e.g. heavy blood, severe pain, high fever), gently suggest contacting their doctor.

When logging, infer the single most relevant entryType and fill the structured data fields you can. Don't ask for fields the user didn't mention. If the user reports multiple things at once, call log_health_entry multiple times. For meals, set food_class (anti-inflammatory / neutral / pro-inflammatory) and any fitting IBD tags; for exercise, capture intensity and post-workout fatigue when mentioned.

${AID_AI_GUIDANCE}

${FLARE_AI_GUIDANCE}

${ANALYST_AI_GUIDANCE}

Today's date is ${new Date().toISOString().split('T')[0]}.`

const TOOLS = [
  {
    type: 'function',
    name: 'log_health_entry',
    description:
      'Record a health event the user just described: bowel movements, symptoms, meals, medications, sleep, or exercise.',
    parameters: {
      type: 'object',
      properties: {
        entryType: {
          type: 'string',
          enum: ['bowel_movement', 'symptom', 'meal', 'medication', 'sleep', 'exercise'],
        },
        summary: { type: 'string', description: 'Short plain-English summary of what was logged' },
        data: {
          type: 'object',
          description:
            'Structured fields relevant to the entry. ' +
            'bowel_movement: count, consistency, blood, urgency, pain_before. ' +
            'symptom: pain_scale, fatigue, bloating, nausea, notes. ' +
            'meal: description, meal_type (breakfast|lunch|dinner|snack), portion (small|medium|large), food_class (anti-inflammatory|neutral|pro-inflammatory), tags (IBD tags like dairy, fried, fermented), calories (only if stated). ' +
            'medication: med_name, dose, taken. ' +
            'sleep: duration_hours, quality. ' +
            'exercise: type, focus, duration_minutes, intensity (easy|moderate|hard), rpe, post_workout_fatigue, steps. ' +
            'Only include what is relevant.',
        },
        rawTranscript: { type: 'string', description: 'The original user phrasing' },
      },
      required: ['entryType', 'summary'],
    },
  },
  {
    type: 'function',
    name: 'get_today_status',
    description: "Get today's stability score, today's logged entries, and active medications.",
    parameters: { type: 'object', properties: {} },
  },
  {
    type: 'function',
    name: 'get_recent_activity',
    description: 'Get the most recent health log entries across all types.',
    parameters: {
      type: 'object',
      properties: { limit: { type: 'number', description: 'How many entries (default 20)' } },
    },
  },
  {
    type: 'function',
    name: 'get_trend',
    description: 'Get the daily stability score history over the past N days to understand trends.',
    parameters: {
      type: 'object',
      properties: { days: { type: 'number', description: 'Number of days (default 7)' } },
    },
  },
  {
    type: 'function',
    name: 'get_diet_guidance',
    description:
      "Get the user's current anti-inflammatory diet (IBD-AID) phase and today's food tally. Call before giving food or diet advice so suggestions match their phase.",
    parameters: { type: 'object', properties: {} },
  },
  {
    type: 'function',
    name: 'get_flare_fingerprint',
    description:
      "Compare today against the patient's learned flare fingerprint and list which signals are outside their personal baseline. Call FIRST for 'why do I feel worse', 'what changed', or 'am I flaring'.",
    parameters: { type: 'object', properties: {} },
  },
  {
    type: 'function',
    name: 'get_signals',
    description:
      "Get the background analyst's current findings, ranked by severity. Call at the start of a conversation to proactively surface anything important.",
    parameters: { type: 'object', properties: {} },
  },
  {
    type: 'function',
    name: 'get_labs',
    description:
      'Get the latest lab results from the patient\'s imported medical records (CRP, fecal calprotectin, ferritin, hemoglobin, WBC, albumin, ESR) with value, status (low/normal/high), and trend. Use for ANY question about labs, inflammation markers, or bloodwork.',
    parameters: { type: 'object', properties: {} },
  },
  {
    type: 'function',
    name: 'get_food_exercise_trends',
    description:
      'Get how the patient\'s diet (anti-inflammatory vs. pro-inflammatory meal balance, common trigger foods) and exercise (active days, total minutes, trend) have been over the last N days. Use for meal/diet/movement pattern questions.',
    parameters: {
      type: 'object',
      properties: { days: { type: 'number', description: 'Window in days (default 14)' } },
    },
  },
]

// ---- PCM helpers ----
function floatTo16BitPCM(float32: Float32Array): ArrayBuffer {
  const buffer = new ArrayBuffer(float32.length * 2)
  const view = new DataView(buffer)
  for (let i = 0; i < float32.length; i++) {
    const s = Math.max(-1, Math.min(1, float32[i]))
    view.setInt16(i * 2, s < 0 ? s * 0x8000 : s * 0x7fff, true)
  }
  return buffer
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  let binary = ''
  const bytes = new Uint8Array(buffer)
  const chunk = 0x8000
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk))
  }
  return btoa(binary)
}

function base64ToInt16(base64: string): Int16Array {
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return new Int16Array(bytes.buffer)
}

export interface LogDraft {
  entryType: string
  summary: string
  data: Record<string, unknown>
}

export function useVoiceAgent({ onLogDraft }: { onLogDraft?: (draft: LogDraft) => void } = {}) {
  // Keep the latest callback without re-binding the websocket handlers.
  const onLogDraftRef = useRef(onLogDraft)
  useEffect(() => {
    onLogDraftRef.current = onLogDraft
  }, [onLogDraft])

  const [status, setStatus] = useState<VoiceStatus>('idle')
  const [error, setError] = useState<string | null>(null)
  const [turns, setTurns] = useState<TranscriptTurn[]>([])
  const [muted, setMuted] = useState(false)

  const wsRef = useRef<WebSocket | null>(null)
  const inputCtxRef = useRef<AudioContext | null>(null)
  const outputCtxRef = useRef<AudioContext | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const processorRef = useRef<ScriptProcessorNode | null>(null)
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null)
  const mutedRef = useRef(false)
  // playback scheduling
  const playheadRef = useRef(0)
  const assistantTurnRef = useRef<string | null>(null)
  const userTurnRef = useRef<string | null>(null)

  // Manual turns (typed chat / photo) share the same transcript as voice.
  const manualIdRef = useRef(0)
  const pushTurn = useCallback(
    (role: 'user' | 'assistant', text: string, extra?: Partial<TranscriptTurn>) => {
      const id = `m-${++manualIdRef.current}`
      setTurns((prev) => [...prev, { id, role, text, done: true, ...extra }])
      return id
    },
    []
  )
  const patchTurn = useCallback((id: string, patch: Partial<TranscriptTurn>) => {
    setTurns((prev) => prev.map((t) => (t.id === id ? { ...t, ...patch } : t)))
  }, [])

  const upsertTurn = useCallback((turn: TranscriptTurn) => {
    setTurns((prev) => {
      const idx = prev.findIndex((t) => t.id === turn.id)
      if (idx === -1) return [...prev, turn]
      const next = [...prev]
      next[idx] = { ...next[idx], ...turn }
      return next
    })
  }, [])

  const appendToTurn = useCallback((id: string, role: 'user' | 'assistant', delta: string) => {
    setTurns((prev) => {
      const idx = prev.findIndex((t) => t.id === id)
      if (idx === -1) return [...prev, { id, role, text: delta, done: false }]
      const next = [...prev]
      next[idx] = { ...next[idx], text: next[idx].text + delta }
      return next
    })
  }, [])

  const playAudioChunk = useCallback((int16: Int16Array) => {
    const ctx = outputCtxRef.current
    if (!ctx) return
    const float32 = new Float32Array(int16.length)
    for (let i = 0; i < int16.length; i++) float32[i] = int16[i] / 32768
    const audioBuffer = ctx.createBuffer(1, float32.length, SAMPLE_RATE)
    audioBuffer.copyToChannel(float32, 0)
    const src = ctx.createBufferSource()
    src.buffer = audioBuffer
    src.connect(ctx.destination)
    const now = ctx.currentTime
    const startAt = Math.max(now, playheadRef.current)
    src.start(startAt)
    playheadRef.current = startAt + audioBuffer.duration
  }, [])

  const sendToolResult = useCallback((callId: string, output: unknown) => {
    const ws = wsRef.current
    if (!ws || ws.readyState !== WebSocket.OPEN) return
    ws.send(
      JSON.stringify({
        type: 'conversation.item.create',
        item: { type: 'function_call_output', call_id: callId, output: JSON.stringify(output) },
      })
    )
    ws.send(JSON.stringify({ type: 'response.create' }))
  }, [])

  const handleFunctionCall = useCallback(
    async (name: string, callId: string, rawArgs: string) => {
      let args: Record<string, unknown> = {}
      try {
        args = rawArgs ? JSON.parse(rawArgs) : {}
      } catch {
        /* ignore */
      }
      // tag the active assistant turn with the tool used
      if (assistantTurnRef.current) {
        upsertTurn({ id: assistantTurnRef.current, role: 'assistant', text: '', done: false, tool: name })
      }
      try {
        let result: unknown
        switch (name) {
          case 'log_health_entry': {
            // Don't save outright — surface a pre-filled review card the user
            // confirms & saves (parity with the typed flow).
            const a = args as { entryType?: string; summary?: string; data?: Record<string, unknown> }
            onLogDraftRef.current?.({
              entryType: a.entryType ?? 'symptom',
              summary: a.summary ?? '',
              data: a.data ?? {},
            })
            result = { ok: true, shown: true, note: "A pre-filled review card is now on the user's screen to confirm and save." }
            break
          }
          case 'get_today_status':
            result = await voiceGetTodayStatus()
            break
          case 'get_recent_activity':
            result = await voiceGetRecentActivity(args as never)
            break
          case 'get_trend':
            result = await voiceGetTrend(args as never)
            break
          case 'get_diet_guidance':
            result = await voiceGetDietGuidance()
            break
          case 'get_flare_fingerprint':
            result = await voiceGetFlareFingerprint()
            break
          case 'get_signals':
            result = await voiceGetSignals()
            break
          case 'get_labs':
            result = await voiceGetLabs()
            break
          case 'get_food_exercise_trends':
            result = await voiceGetFoodExerciseTrends(args as never)
            break
          default:
            result = { error: `Unknown function ${name}` }
        }
        sendToolResult(callId, result)
      } catch (err) {
        console.error('[v0] voice tool error:', name, err)
        sendToolResult(callId, { error: 'Failed to execute that action.' })
      }
    },
    [sendToolResult, upsertTurn]
  )

  const stop = useCallback(() => {
    processorRef.current?.disconnect()
    sourceRef.current?.disconnect()
    streamRef.current?.getTracks().forEach((t) => t.stop())
    inputCtxRef.current?.close().catch(() => {})
    outputCtxRef.current?.close().catch(() => {})
    wsRef.current?.close()
    processorRef.current = null
    sourceRef.current = null
    streamRef.current = null
    inputCtxRef.current = null
    outputCtxRef.current = null
    wsRef.current = null
    playheadRef.current = 0
    assistantTurnRef.current = null
    userTurnRef.current = null
    // Finalize any in-flight turn so its "Thinking…/Transcribing…" spinner stops;
    // drop empty placeholders that never received content.
    setTurns((prev) =>
      prev
        .filter((t) => t.text.trim() !== '' || t.done)
        .map((t) => (t.done ? t : { ...t, done: true }))
    )
    setStatus('idle')
  }, [])

  const toggleMute = useCallback(() => {
    mutedRef.current = !mutedRef.current
    setMuted(mutedRef.current)
  }, [])

  const start = useCallback(async () => {
    setError(null)
    setStatus('connecting')
    try {
      // 1. Mint an ephemeral token
      const tokenRes = await fetch('/api/voice-token', { method: 'POST' })
      if (!tokenRes.ok) {
        const body = await tokenRes.json().catch(() => ({}))
        throw new Error(body.error || 'Could not start a voice session.')
      }
      const { token } = await tokenRes.json()

      // 2. Get mic access
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true },
      })
      streamRef.current = stream

      // 3. Audio contexts (input capture + output playback) at the model sample rate
      const inputCtx = new AudioContext({ sampleRate: SAMPLE_RATE })
      const outputCtx = new AudioContext({ sampleRate: SAMPLE_RATE })
      inputCtxRef.current = inputCtx
      outputCtxRef.current = outputCtx
      playheadRef.current = outputCtx.currentTime

      // 4. Open the WebSocket using the ephemeral token via subprotocol
      const ws = new WebSocket('wss://api.x.ai/v1/realtime', [`xai-client-secret.${token}`])
      wsRef.current = ws

      ws.onopen = () => {
        ws.send(
          JSON.stringify({
            type: 'session.update',
            session: {
              instructions: SESSION_INSTRUCTIONS,
              voice: 'ara',
              turn_detection: { type: 'server_vad' },
              tools: TOOLS,
              audio: {
                input: { format: { type: 'audio/pcm', rate: SAMPLE_RATE } },
                output: { format: { type: 'audio/pcm', rate: SAMPLE_RATE } },
              },
            },
          })
        )

        // 5. Start streaming mic audio
        const source = inputCtx.createMediaStreamSource(stream)
        const processor = inputCtx.createScriptProcessor(4096, 1, 1)
        sourceRef.current = source
        processorRef.current = processor
        processor.onaudioprocess = (e) => {
          if (mutedRef.current) return
          if (ws.readyState !== WebSocket.OPEN) return
          const input = e.inputBuffer.getChannelData(0)
          const pcm = floatTo16BitPCM(input)
          ws.send(
            JSON.stringify({ type: 'input_audio_buffer.append', audio: arrayBufferToBase64(pcm) })
          )
        }
        source.connect(processor)
        processor.connect(inputCtx.destination)
        setStatus('listening')
      }

      ws.onmessage = (event) => {
        let msg: Record<string, unknown>
        try {
          msg = JSON.parse(typeof event.data === 'string' ? event.data : '')
        } catch {
          return
        }
        const type = msg.type as string

        switch (type) {
          case 'input_audio_buffer.speech_started':
            setStatus('listening')
            // start a fresh user turn bubble
            userTurnRef.current = `user-${Date.now()}`
            upsertTurn({ id: userTurnRef.current, role: 'user', text: '', done: false })
            break
          case 'input_audio_buffer.speech_stopped':
            setStatus('thinking')
            break
          case 'conversation.item.input_audio_transcription.completed': {
            const id = userTurnRef.current || `user-${Date.now()}`
            upsertTurn({ id, role: 'user', text: (msg.transcript as string) || '', done: true })
            break
          }
          case 'response.created':
            assistantTurnRef.current = `assistant-${(msg as { response?: { id?: string } }).response?.id || Date.now()}`
            upsertTurn({ id: assistantTurnRef.current, role: 'assistant', text: '', done: false })
            setStatus('thinking')
            break
          case 'response.output_audio_transcript.delta':
            if (assistantTurnRef.current) {
              appendToTurn(assistantTurnRef.current, 'assistant', (msg.delta as string) || '')
            }
            break
          case 'response.output_audio.delta':
            setStatus('speaking')
            playAudioChunk(base64ToInt16(msg.delta as string))
            break
          case 'response.output_audio_transcript.done':
            if (assistantTurnRef.current) {
              upsertTurn({ id: assistantTurnRef.current, role: 'assistant', text: '', done: true })
            }
            break
          case 'response.function_call_arguments.done':
            handleFunctionCall(
              msg.name as string,
              msg.call_id as string,
              msg.arguments as string
            )
            break
          case 'response.done':
            setStatus('listening')
            break
          case 'error':
            console.error('[v0] voice agent error event:', msg)
            break
        }
      }

      ws.onerror = (e) => {
        console.error('[v0] voice websocket error:', e)
        setError('Lost connection to the voice service.')
        setStatus('error')
      }

      ws.onclose = () => {
        if (status !== 'error') setStatus('idle')
      }
    } catch (err) {
      console.error('[v0] voice start error:', err)
      setError(err instanceof Error ? err.message : 'Could not start voice session.')
      setStatus('error')
      stop()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [appendToTurn, handleFunctionCall, playAudioChunk, stop, upsertTurn])

  return { status, error, turns, muted, start, stop, toggleMute, pushTurn, patchTurn }
}
