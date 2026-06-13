import { MacroFactorImporter } from '@/components/imports/macrofactor-importer'
import { getRecentLogEntries } from '@/lib/actions'
import { Upload } from 'lucide-react'

export const dynamic = 'force-dynamic'

export default async function ImportsPage() {
  const recent = await getRecentLogEntries(200)
  const importedCount = recent.filter((e) => e.source === 'macrofactor').length

  return (
    <div className="flex flex-col gap-4 px-4 pt-6 pb-4">
      <header className="flex flex-col gap-1">
        <div className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/15">
            <Upload className="h-5 w-5 text-primary" strokeWidth={2.2} />
          </div>
          <h1 className="text-xl font-semibold text-foreground">Import Data</h1>
        </div>
        <p className="text-sm text-muted-foreground leading-relaxed">
          Upload a MacroFactor Excel export to bring in your nutrition, macros, and
          body-weight history. Data is matched by date and merged into your timeline.
        </p>
      </header>

      <MacroFactorImporter alreadyImported={importedCount} />
    </div>
  )
}
