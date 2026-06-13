import { NextRequest, NextResponse } from 'next/server'
import * as XLSX from 'xlsx'
import { parseMacroFactorSheets } from '@/lib/macrofactor-parser'

export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()
    const file = formData.get('file')

    if (!file || !(file instanceof File)) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }

    const buffer = Buffer.from(await file.arrayBuffer())
    // XLSX.read auto-detects .csv vs .xlsx from the buffer contents.
    const workbook = XLSX.read(buffer, { cellDates: true, raw: false })

    const sheets = workbook.SheetNames.map((name) => {
      const ws = workbook.Sheets[name]
      const rows = XLSX.utils.sheet_to_json(ws, { defval: '' }) as Record<string, unknown>[]
      return { name, rows }
    })

    const result = parseMacroFactorSheets(sheets)

    if (result.days.length === 0) {
      return NextResponse.json(
        {
          error: 'No recognizable data found. Expected MacroFactor columns (sheet, date, metric, value).',
          sheetSummary: result.sheetSummary,
        },
        { status: 422 }
      )
    }

    return NextResponse.json(result)
  } catch (err) {
    console.log('[v0] MacroFactor import error:', err instanceof Error ? err.message : err)
    return NextResponse.json(
      { error: 'Failed to parse the file. Make sure it is a valid MacroFactor .csv or .xlsx export.' },
      { status: 500 }
    )
  }
}
