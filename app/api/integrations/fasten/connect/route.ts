import { NextRequest, NextResponse } from 'next/server'

export const runtime = 'nodejs'

// After the Stitch widget completes, the browser sends us the org_connection_id;
// we trigger the EHI export server-side (private key never touches the browser).
// Fasten processes async and POSTs the download links to our webhook on success.
export async function POST(req: NextRequest) {
  const { orgConnectionId } = (await req.json().catch(() => ({}))) as { orgConnectionId?: string }
  if (!orgConnectionId) {
    return NextResponse.json({ error: 'Missing orgConnectionId' }, { status: 400 })
  }

  const pub = process.env.FASTEN_PUBLIC_ID
  const priv = process.env.FASTEN_PRIVATE_KEY
  const base = process.env.FASTEN_API_BASE ?? 'https://api.connect.fastenhealth.com/v1'
  if (!pub || !priv) {
    return NextResponse.json({ error: 'Fasten is not configured (missing credentials).' }, { status: 500 })
  }

  const auth = 'Basic ' + Buffer.from(`${pub}:${priv}`).toString('base64')
  try {
    const res = await fetch(`${base}/bridge/fhir/ehi-export`, {
      method: 'POST',
      headers: { Authorization: auth, 'Content-Type': 'application/json' },
      body: JSON.stringify({ org_connection_id: orgConnectionId }),
    })
    const json = (await res.json().catch(() => ({}))) as { data?: { task_id?: string; status?: string } }
    if (!res.ok) {
      console.error('[fasten] export trigger failed', res.status, json)
      return NextResponse.json({ error: 'Could not start the records export.' }, { status: 502 })
    }
    return NextResponse.json({ taskId: json?.data?.task_id, status: json?.data?.status ?? 'pending' })
  } catch (err) {
    console.error('[fasten] connect error:', err instanceof Error ? err.message : err)
    return NextResponse.json({ error: 'Fasten request failed.' }, { status: 500 })
  }
}
