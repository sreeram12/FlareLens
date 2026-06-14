'use client'

import Link from 'next/link'
import { Mic, AlertTriangle, FileText, Upload } from 'lucide-react'
import { cn } from '@/lib/utils'

/** Compact top toolbar of primary actions (sits right under the Today header). */
export function QuickActions({ currentScore }: { currentScore: number }) {
  const showFlareAlert = currentScore >= 45
  const base =
    'flex items-center gap-2 rounded-xl border px-3.5 py-2.5 text-sm font-medium transition-colors'

  return (
    <div className="flex flex-wrap gap-2">
      <Link href="/talk" className={cn(base, 'border-primary/40 bg-primary/10 text-primary hover:bg-primary/15')}>
        <Mic className="h-4 w-4" strokeWidth={2} /> Talk &amp; Log
      </Link>
      {showFlareAlert && (
        <Link href="/report" className={cn(base, 'border-red-500/40 bg-red-500/10 text-red-400 hover:bg-red-500/15')}>
          <AlertTriangle className="h-4 w-4" strokeWidth={2} /> Flare Mode
        </Link>
      )}
      <Link href="/report" className={cn(base, 'border-border bg-card text-foreground hover:bg-secondary/50')}>
        <FileText className="h-4 w-4 text-muted-foreground" strokeWidth={1.8} /> Doctor Report
      </Link>
      <Link href="/imports" className={cn(base, 'border-border bg-card text-foreground hover:bg-secondary/50')}>
        <Upload className="h-4 w-4 text-muted-foreground" strokeWidth={1.8} /> Import
      </Link>
    </div>
  )
}
