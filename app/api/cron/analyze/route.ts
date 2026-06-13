import { NextRequest, NextResponse } from 'next/server'
import { runAnalysis } from '@/lib/actions'

export const runtime = 'nodejs'
export const maxDuration = 60

// Background analyst entrypoint. Triggered by Vercel Cron (see vercel.json) a few
// times a day; the app also refreshes on open. If CRON_SECRET is set, Vercel
// sends it as a bearer token — we verify it; otherwise we allow (demo mode).
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET
  if (secret && req.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const active = await runAnalysis()
    return NextResponse.json({ ok: true, findings: active.length })
  } catch (err) {
    console.error('[v0] cron analyze error:', err instanceof Error ? err.message : err)
    return NextResponse.json({ error: 'analysis failed' }, { status: 500 })
  }
}
