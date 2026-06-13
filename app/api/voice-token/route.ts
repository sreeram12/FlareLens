import { NextResponse } from 'next/server'

// Mints a short-lived ephemeral token so the browser can open a WebSocket to
// the xAI Voice Agent API without ever exposing the long-lived API key.
export async function POST() {
  const apiKey = process.env.AI_GATEWAY_API_KEY
  if (!apiKey) {
    return NextResponse.json(
      { error: 'Voice service is not configured (missing API key).' },
      { status: 500 }
    )
  }

  try {
    const res = await fetch('https://api.x.ai/v1/realtime/client_secrets', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        expires_after: { seconds: 600 },
        model: 'grok-voice-think-fast-1.1',
      }),
    })

    if (!res.ok) {
      const text = await res.text()
      console.error('[v0] voice-token mint failed:', res.status, text)
      const status = res.status === 401 || res.status === 403 ? 401 : 502
      return NextResponse.json(
        {
          error:
            status === 401
              ? 'The voice API key is invalid or missing access to the voice model.'
              : 'Could not start a voice session right now. Please try again.',
        },
        { status }
      )
    }

    const data = await res.json()
    // Response shape: { value: "xai-client-secret....", expires_at: number }
    return NextResponse.json({ token: data.value, expiresAt: data.expires_at })
  } catch (err) {
    console.error('[v0] voice-token error:', err)
    return NextResponse.json({ error: 'Failed to start voice session.' }, { status: 500 })
  }
}
