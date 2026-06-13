'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

// ─── Speech Recognition (speech-to-text) ─────────────────────────────────────

interface SpeechRecognitionHook {
  supported: boolean
  listening: boolean
  interimText: string
  start: () => void
  stop: () => void
}

export function useSpeechRecognition(
  onFinalResult: (text: string) => void
): SpeechRecognitionHook {
  const [supported, setSupported] = useState(false)
  const [listening, setListening] = useState(false)
  const [interimText, setInterimText] = useState('')
  const recognitionRef = useRef<any>(null)
  const finalRef = useRef<string>('')

  useEffect(() => {
    if (typeof window === 'undefined') return
    const SR =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    if (!SR) return

    setSupported(true)
    const recognition = new SR()
    recognition.continuous = true
    recognition.interimResults = true
    recognition.lang = 'en-US'

    recognition.onresult = (event: any) => {
      let interim = ''
      let final = ''
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript
        if (event.results[i].isFinal) {
          final += transcript
        } else {
          interim += transcript
        }
      }
      if (final) finalRef.current += final
      setInterimText(interim)
    }

    recognition.onend = () => {
      setListening(false)
      setInterimText('')
      const text = finalRef.current.trim()
      finalRef.current = ''
      if (text) onFinalResult(text)
    }

    recognition.onerror = (e: any) => {
      console.log('[v0] Speech recognition error:', e.error)
      setListening(false)
    }

    recognitionRef.current = recognition

    return () => {
      try {
        recognition.stop()
      } catch {}
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const start = useCallback(() => {
    if (!recognitionRef.current || listening) return
    finalRef.current = ''
    setInterimText('')
    try {
      recognitionRef.current.start()
      setListening(true)
    } catch (e) {
      console.log('[v0] Could not start recognition:', e)
    }
  }, [listening])

  const stop = useCallback(() => {
    if (!recognitionRef.current) return
    try {
      recognitionRef.current.stop()
    } catch {}
  }, [])

  return { supported, listening, interimText, start, stop }
}

// ─── Speech Synthesis (text-to-speech) ───────────────────────────────────────

interface SpeechSynthesisHook {
  supported: boolean
  speaking: boolean
  speak: (text: string) => void
  cancel: () => void
}

export function useSpeechSynthesis(): SpeechSynthesisHook {
  const [supported, setSupported] = useState(false)
  const [speaking, setSpeaking] = useState(false)
  const voiceRef = useRef<SpeechSynthesisVoice | null>(null)

  useEffect(() => {
    if (typeof window === 'undefined' || !window.speechSynthesis) return
    setSupported(true)

    const pickVoice = () => {
      const voices = window.speechSynthesis.getVoices()
      // Prefer a natural-sounding English voice
      voiceRef.current =
        voices.find((v) => /Samantha|Google US English|Microsoft Aria/i.test(v.name)) ||
        voices.find((v) => v.lang.startsWith('en') && v.localService) ||
        voices.find((v) => v.lang.startsWith('en')) ||
        voices[0] ||
        null
    }
    pickVoice()
    window.speechSynthesis.onvoiceschanged = pickVoice
  }, [])

  const speak = useCallback((text: string) => {
    if (typeof window === 'undefined' || !window.speechSynthesis || !text) return
    window.speechSynthesis.cancel()
    const utterance = new SpeechSynthesisUtterance(text)
    if (voiceRef.current) utterance.voice = voiceRef.current
    utterance.rate = 1.02
    utterance.pitch = 1
    utterance.onstart = () => setSpeaking(true)
    utterance.onend = () => setSpeaking(false)
    utterance.onerror = () => setSpeaking(false)
    window.speechSynthesis.speak(utterance)
  }, [])

  const cancel = useCallback(() => {
    if (typeof window === 'undefined' || !window.speechSynthesis) return
    window.speechSynthesis.cancel()
    setSpeaking(false)
  }, [])

  return { supported, speaking, speak, cancel }
}
