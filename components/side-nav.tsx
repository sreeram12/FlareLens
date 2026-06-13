'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { NAV_ITEMS } from './nav-items'
import { cn } from '@/lib/utils'

/** Desktop/laptop left rail. Hidden on mobile (bottom nav takes over). */
export function SideNav() {
  const pathname = usePathname()

  return (
    <aside className="hidden lg:flex fixed left-0 top-0 z-40 h-screen w-60 flex-col gap-1 border-r border-border bg-[var(--glass-bg)] backdrop-blur-xl px-3 py-5">
      {/* Brand */}
      <Link href="/today" className="flex items-center gap-2.5 px-2 mb-6">
        <span className="h-2.5 w-2.5 rounded-full bg-primary shadow-[0_0_12px_2px_oklch(var(--glow-color)/70%)]" />
        <span className="font-mono text-sm font-semibold uppercase tracking-[0.22em] text-foreground text-glow">
          FlareLens
        </span>
      </Link>

      {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
        const isActive = pathname === href
        return (
          <Link
            key={href}
            href={href}
            className={cn(
              'relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
              isActive ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:text-foreground hover:bg-card'
            )}
          >
            {isActive && (
              <span className="absolute left-0 top-1/2 -translate-y-1/2 h-5 w-0.5 rounded-full bg-primary shadow-[0_0_10px_1px_oklch(var(--glow-color)/70%)]" />
            )}
            <Icon className={cn('h-5 w-5', isActive && 'text-glow')} strokeWidth={isActive ? 2.4 : 1.9} />
            {label}
          </Link>
        )
      })}

      <p className="mt-auto px-2 text-[10px] leading-relaxed text-muted-foreground/60">
        Crohn&apos;s voice companion · organizes your data, not a diagnosis.
      </p>
    </aside>
  )
}
