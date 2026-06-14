import { NextRequest, NextResponse } from 'next/server'
import { parseFhirNdjson } from '@/lib/fasten-fhir'
import { saveFastenImport } from '@/lib/actions'

export const runtime = 'nodejs'
export const maxDuration = 60

interface FastenWebhook {
  type?: string
  api_mode?: string
  data?: { download_links?: { url?: string }[]; task_id?: string }
}

// Fasten POSTs here when an export finishes. We download each link (private key
// is server-side, follow the signed-URL redirect), parse the FHIR NDJSON, and
// upsert it. Needs a public URL — on localhost, tunnel via smee.io/ngrok.
export async function POST(req: NextRequest) {
  let body: FastenWebhook
  try {
    body = (await req.json()) as FastenWebhook
  } catch {
    return NextResponse.json({ error: 'bad json' }, { status: 400 })
  }

  // Only act on successful exports; acknowledge everything else.
  if (body.type !== 'patient.ehi_export_success') {
    return NextResponse.json({ ok: true, ignored: body.type ?? 'unknown' })
  }

  const pub = process.env.FASTEN_PUBLIC_ID
  const priv = process.env.FASTEN_PRIVATE_KEY
  if (!pub || !priv) {
    return NextResponse.json({ error: 'Fasten not configured' }, { status: 500 })
  }
  const auth = 'Basic ' + Buffer.from(`${pub}:${priv}`).toString('base64')

  const links = body.data?.download_links ?? []
  let labs = 0
  let clinical = 0
  let meds = 0
  try {
    for (const link of links) {
      if (!link?.url) continue
      const res = await fetch(link.url, { headers: { Authorization: auth }, redirect: 'follow' })
      if (!res.ok) {
        console.error('[fasten] download failed', res.status, link.url)
        continue
      }
      const text = await res.text()
      const records = parseFhirNdjson(text)
      const saved = await saveFastenImport(records)
      labs += saved.labsInserted
      clinical += saved.clinicalInserted
      meds += saved.medsInserted
    }
  } catch (err) {
    console.error('[fasten] webhook ingest error:', err instanceof Error ? err.message : err)
    return NextResponse.json({ error: 'ingest failed' }, { status: 500 })
  }

  console.log(`[fasten] webhook ingested task=${body.data?.task_id}: ${labs} labs, ${clinical} clinical, ${meds} meds`)
  return NextResponse.json({ ok: true, labs, clinical, meds })
}
