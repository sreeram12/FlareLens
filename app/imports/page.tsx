import { MacroFactorImporter } from '@/components/imports/macrofactor-importer'
import { FastenImporter } from '@/components/imports/fasten-importer'
import { FastenConnect } from '@/components/imports/fasten-connect'
import { getRecentLogEntries } from '@/lib/actions'
import { Upload } from 'lucide-react'

export const dynamic = 'force-dynamic'

export default async function ImportsPage() {
  const recent = await getRecentLogEntries(300)
  const macroCount = recent.filter((e) => e.source === 'macrofactor').length
  const fastenCount = recent.filter((e) => e.source === 'fasten').length

  return (
    <div className="mx-auto w-full max-w-2xl lg:max-w-3xl flex flex-col gap-6 px-4 pt-6 pb-4">
      <header className="flex flex-col gap-1">
        <div className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/15">
            <Upload className="h-5 w-5 text-primary" strokeWidth={2.2} />
          </div>
          <h1 className="text-xl font-semibold text-foreground">Connect your data</h1>
        </div>
        <p className="text-sm text-muted-foreground leading-relaxed">
          Bring in nutrition, body metrics, and medical records so FlareLens can compare everything
          against your personal baseline. Data is matched by date and merged into your timeline.
        </p>
      </header>

      <FastenConnect initialCount={fastenCount} />

      <FastenImporter alreadyImported={fastenCount} />

      <div className="h-px bg-border" />

      <section className="flex flex-col gap-3">
        <div>
          <h2 className="text-sm font-semibold text-foreground">Nutrition &amp; body (MacroFactor)</h2>
          <p className="text-xs text-muted-foreground">Calories, macros, the IBD micronutrient panel, weight, and steps</p>
        </div>
        <MacroFactorImporter alreadyImported={macroCount} />
      </section>
    </div>
  )
}
