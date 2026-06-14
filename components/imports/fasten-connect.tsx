'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, CheckCircle2, ShieldCheck } from 'lucide-react'
import { getFastenRecordCount } from '@/lib/actions'

const PUBLIC_ID = process.env.NEXT_PUBLIC_FASTEN_PUBLIC_ID

type Status = 'idle' | 'syncing' | 'synced' | 'error'
interface StitchPayload {
  event_type?: string
  data?: { org_connection_id?: string }[]
}

/**
 * Fasten Connect — one-time patient-portal login via the Stitch web component.
 * On completion we trigger the export server-side; records arrive async through
 * the webhook, so we poll the imported-record count and refresh when they land.
 * Renders nothing if NEXT_PUBLIC_FASTEN_PUBLIC_ID isn't configured.
 */
export function FastenConnect({ initialCount }: { initialCount: number }) {
  const router = useRouter()
  const hostRef = useRef<HTMLDivElement>(null)
  const [status, setStatus] = useState<Status>('idle')
  const [msg, setMsg] = useState('')

  async function startSync(orgConnectionId: string) {
    setStatus('syncing')
    setMsg('Connected — pulling your records…')
    try {
      const res = await fetch('/api/integrations/fasten/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orgConnectionId }),
      })
      if (!res.ok) throw new Error()
    } catch {
      setStatus('error')
      setMsg('Could not start the records sync — try again.')
      return
    }
    // Records arrive asynchronously via the webhook; poll for them.
    for (let i = 0; i < 40; i++) {
      await new Promise((r) => setTimeout(r, 3000))
      const count = await getFastenRecordCount().catch(() => initialCount)
      if (count > initialCount) {
        setStatus('synced')
        setMsg(`Synced ${count - initialCount} new records from your provider.`)
        router.refresh()
        return
      }
    }
    setStatus('synced')
    setMsg('Connected. Records can take a few minutes to arrive — they’ll appear automatically.')
    router.refresh()
  }

  useEffect(() => {
    if (!PUBLIC_ID || !hostRef.current) return

    // Load the Stitch CSS + module once.
    if (!document.querySelector('link[data-fasten-css]')) {
      const l = document.createElement('link')
      l.rel = 'stylesheet'
      l.href = 'https://cdn.fastenhealth.com/connect/v4/fasten-stitch-element.css'
      l.setAttribute('data-fasten-css', '1')
      document.head.appendChild(l)
    }
    if (!document.querySelector('script[data-fasten-js]')) {
      const s = document.createElement('script')
      s.type = 'module'
      s.src = 'https://cdn.fastenhealth.com/connect/v4/fasten-stitch-element.js'
      s.setAttribute('data-fasten-js', '1')
      document.head.appendChild(s)
    }

    const onEvent = (event: Event) => {
      const detail = (event as CustomEvent<{ data: string }>).detail
      let payload: StitchPayload
      try {
        payload = JSON.parse(detail.data)
      } catch {
        return
      }
      if (payload.event_type === 'widget.complete') {
        const id = payload.data?.[0]?.org_connection_id
        if (id) void startSync(id)
      }
    }

    const el = document.createElement('fasten-stitch-element')
    el.setAttribute('public-id', PUBLIC_ID)
    el.addEventListener('eventBus', onEvent)
    hostRef.current.appendChild(el)
    return () => {
      el.removeEventListener('eventBus', onEvent)
      el.remove()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (!PUBLIC_ID) return null

  return (
    <div className="rounded-xl border border-rose-500/20 bg-rose-500/5 p-4">
      <div className="mb-2 flex items-center gap-2">
        <ShieldCheck className="h-4 w-4 text-rose-400" />
        <p className="text-sm font-semibold text-foreground">Connect your patient portal</p>
      </div>
      <p className="mb-3 text-xs leading-relaxed text-muted-foreground">
        Log in once (Kaiser, Epic, and more) and FlareLens keeps your conditions, medications, and labs in sync — analyzed into trends and folded into your report and diet guidance.
      </p>

      <div ref={hostRef} />

      {status === 'syncing' && (
        <div className="mt-3 flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin text-primary" /> {msg}
        </div>
      )}
      {status === 'synced' && (
        <div className="mt-3 flex items-center gap-2 text-sm text-emerald-400">
          <CheckCircle2 className="h-4 w-4" /> {msg}
        </div>
      )}
      {status === 'error' && <p className="mt-3 text-sm text-destructive">{msg}</p>}
    </div>
  )
}
