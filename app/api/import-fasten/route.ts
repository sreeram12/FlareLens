import { NextRequest, NextResponse } from 'next/server'
import { parseFhirNdjson } from '@/lib/fasten-fhir'
import { SAMPLE_FASTEN_NDJSON } from '@/lib/fasten-sample'

export const runtime = 'nodejs'

// Parses a Fasten FHIR NDJSON export (uploaded file) or the bundled sample
// (POST JSON { sample: true }). Returns normalized records for preview; the
// client then confirms and calls the saveFastenImport server action.
export async function POST(req: NextRequest) {
  try {
    const contentType = req.headers.get('content-type') ?? ''
    let text = ''

    if (contentType.includes('application/json')) {
      const body = await req.json().catch(() => ({}))
      if (body?.sample) text = SAMPLE_FASTEN_NDJSON
    } else {
      const form = await req.formData()
      const file = form.get('file')
      if (file instanceof File) text = await file.text()
    }

    if (!text.trim()) {
      return NextResponse.json(
        { error: 'No FHIR data provided. Upload an .ndjson export or load the sample records.' },
        { status: 400 }
      )
    }

    const records = parseFhirNdjson(text)
    if (records.counts.total === 0) {
      return NextResponse.json(
        { error: 'No recognizable FHIR resources found in that file.', resourceTypes: records.resourceTypes },
        { status: 422 }
      )
    }

    return NextResponse.json(records)
  } catch (err) {
    console.error('[v0] Fasten import error:', err instanceof Error ? err.message : err)
    return NextResponse.json(
      { error: 'Failed to parse the file. Make sure it is a valid FHIR NDJSON export.' },
      { status: 500 }
    )
  }
}
