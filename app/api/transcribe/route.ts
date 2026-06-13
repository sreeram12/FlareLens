import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()
    const audio = formData.get('audio') as File | null

    if (!audio) {
      return NextResponse.json({ error: 'No audio file' }, { status: 400 })
    }

    // Transcribe via xAI Grok Speech-to-Text (POST https://api.x.ai/v1/stt).
    // AI_GATEWAY_API_KEY is an xAI key (same one used by /api/voice-token).
    const apiKey = process.env.AI_GATEWAY_API_KEY || process.env.XAI_API_KEY
    if (!apiKey) {
      return NextResponse.json({ error: 'No xAI API key configured' }, { status: 500 })
    }

    const sttForm = new FormData()
    sttForm.append('file', audio, 'recording.webm')
    sttForm.append('model', 'grok-stt')
    sttForm.append('format', 'json')
    sttForm.append('language', 'en')

    const response = await fetch('https://api.x.ai/v1/stt', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}` },
      body: sttForm,
    })

    if (!response.ok) {
      const err = await response.text()
      console.error('[v0] Transcription error:', response.status, err)
      return NextResponse.json({ error: 'Transcription failed' }, { status: 502 })
    }

    const result = await response.json()
    // xAI STT returns the transcript text; fall back across possible shapes.
    const text =
      result.text ?? result.transcript ?? result.results?.[0]?.transcript ?? ''
    return NextResponse.json({ text })
  } catch (error) {
    console.error('[v0] Transcribe route error:', error)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
