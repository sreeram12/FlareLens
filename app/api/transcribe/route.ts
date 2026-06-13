import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()
    const audio = formData.get('audio') as File | null

    if (!audio) {
      return NextResponse.json({ error: 'No audio file' }, { status: 400 })
    }

    // Use xAI-compatible Whisper endpoint via Vercel AI Gateway
    const apiKey = process.env.AI_GATEWAY_API_KEY || process.env.OPENAI_API_KEY
    if (!apiKey) {
      return NextResponse.json({ error: 'No AI API key configured' }, { status: 500 })
    }

    const whisperForm = new FormData()
    whisperForm.append('file', audio, 'recording.webm')
    whisperForm.append('model', 'whisper-1')
    whisperForm.append('language', 'en')

    const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}` },
      body: whisperForm,
    })

    if (!response.ok) {
      const err = await response.text()
      console.error('[v0] Transcription error:', err)
      return NextResponse.json({ error: 'Transcription failed' }, { status: 502 })
    }

    const result = await response.json()
    return NextResponse.json({ text: result.text })
  } catch (error) {
    console.error('[v0] Transcribe route error:', error)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
