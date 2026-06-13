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
    const workbook = XLSX.read(buffer, { cellDates: true })

    const sheets = workbook.SheetNames.map((name) => {
      const ws = workbook.Sheets[name]
      const rows = XLSX.utils.sheet_to_json(ws, { defval: '' }) as Record<string, unknown>[]
      return { name, rows }
    })

    const result = parseMacroFactorSheets(sheets)

    if (result.days.length === 0) {
      return NextResponse.json(
        {
          error: 'No recognizable data found. The file was read but no date/calorie/weight columns matched.',
          sheetSummary: result.sheetSummary,
        },
        { status: 422 }
      )
    }

    return NextResponse.json(result)
  } catch (err) {
    console.log('[v0] MacroFactor import error:', err instanceof Error ? err.message : err)
    return NextResponse.json(
      { error: 'Failed to parse the Excel file. Make sure it is a valid .xlsx export.' },
      { status: 500 }
    )
  }
}
