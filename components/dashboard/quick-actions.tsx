'use client'

import Link from 'next/link'
import { Mic, AlertTriangle, FileText, Upload } from 'lucide-react'
import { cn } from '@/lib/utils'

interface QuickActionsProps {
  currentScore: number
}

export function QuickActions({ currentScore }: QuickActionsProps) {
  const showFlareAlert = currentScore >= 45

  return (
    <div>
      <p className="text-xs font-medium text-muted-foreground tracking-wide uppercase mb-2">
        Quick Actions
      </p>
      <div className="flex flex-col gap-2">
        <Link
          href="/log"
          className="flex items-center gap-3 rounded-xl border border-primary/30 bg-primary/10 p-4 hover:bg-primary/15 transition-colors"
        >
          <div className="h-9 w-9 rounded-lg bg-primary/20 flex items-center justify-center flex-shrink-0">
            <Mic className="h-4.5 w-4.5 text-primary" strokeWidth={2} />
          </div>
          <div>
            <p className="text-sm font-semibold text-foreground">Voice Log</p>
            <p className="text-xs text-muted-foreground">Describe how you feel</p>
          </div>
        </Link>

        {showFlareAlert && (
          <Link
            href="/report"
            className="flex items-center gap-3 rounded-xl border border-red-500/30 bg-red-500/10 p-4 hover:bg-red-500/15 transition-colors"
          >
            <div className="h-9 w-9 rounded-lg bg-red-500/20 flex items-center justify-center flex-shrink-0">
              <AlertTriangle className="h-4.5 w-4.5 text-red-400" strokeWidth={2} />
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground">Flare Mode</p>
              <p className="text-xs text-muted-foreground">Score is high — start a flare check-in</p>
            </div>
          </Link>
        )}

        <div className="grid grid-cols-2 gap-2">
          <Link
            href="/report"
            className="flex items-center gap-2.5 rounded-xl border border-border bg-card p-3 hover:bg-secondary/50 transition-colors"
          >
            <FileText className="h-4 w-4 text-muted-foreground flex-shrink-0" strokeWidth={1.8} />
            <span className="text-sm font-medium text-foreground">Doctor Report</span>
          </Link>
          <Link
            href="/import"
            className="flex items-center gap-2.5 rounded-xl border border-border bg-card p-3 hover:bg-secondary/50 transition-colors"
          >
            <Upload className="h-4 w-4 text-muted-foreground flex-shrink-0" strokeWidth={1.8} />
            <span className="text-sm font-medium text-foreground">Import Data</span>
          </Link>
        </div>
      </div>
    </div>
  )
}
