'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { NAV_ITEMS } from './nav-items'
import { cn } from '@/lib/utils'

const ROW = 44 // px per nav row (h-11), drives the sliding indicator offset

/** Desktop/laptop left rail. Hidden on mobile (bottom nav takes over). */
export function SideNav() {
  const pathname = usePathname()
  const activeIndex = NAV_ITEMS.findIndex((i) => i.href === pathname)

  return (
    <aside className="hidden lg:flex fixed left-0 top-0 z-40 h-screen w-60 flex-col border-r border-border bg-[var(--glass-bg)] px-3 py-5 backdrop-blur-xl">
      {/* Brand → Talk (the voice-first anchor) */}
      <Link
        href="/"
        className="mb-6 flex items-center gap-2.5 rounded-lg px-2 py-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
      >
        <span className="h-2.5 w-2.5 rounded-full bg-primary shadow-[0_0_12px_2px_oklch(var(--glow-color)/70%)]" />
        <span className="font-mono text-sm font-semibold uppercase tracking-[0.22em] text-foreground text-glow">
          FlareLens
        </span>
      </Link>

      <div className="relative flex flex-col">
        {/* Sliding active pill */}
        {activeIndex >= 0 && (
          <span
            aria-hidden
            className="pointer-events-none absolute inset-x-0 top-0 rounded-lg bg-primary/10 transition-transform duration-[260ms] ease-out motion-reduce:transition-none"
            style={{ height: ROW, transform: `translateY(${activeIndex * ROW}px)` }}
          >
            <span className="absolute left-0 top-1/2 h-5 w-0.5 -translate-y-1/2 rounded-full bg-primary shadow-[0_0_10px_1px_oklch(var(--glow-color)/70%)]" />
          </span>
        )}

        {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
          const isActive = pathname === href
          return (
            <Link
              key={href}
              href={href}
              aria-current={isActive ? 'page' : undefined}
              className={cn(
                'relative z-10 flex h-11 items-center gap-3 rounded-lg px-3 text-sm font-medium transition-colors active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]',
                isActive ? 'text-primary' : 'text-muted-foreground hover:bg-card/60 hover:text-foreground'
              )}
            >
              <Icon
                className={cn('h-5 w-5 transition-transform duration-200 ease-out motion-reduce:transition-none', isActive && 'text-glow')}
                strokeWidth={isActive ? 2.4 : 1.9}
              />
              {label}
            </Link>
          )
        })}
      </div>

      <p className="mt-auto px-2 text-[10px] leading-relaxed text-muted-foreground/60">
        Crohn&apos;s voice companion · organizes your data, not a diagnosis.
      </p>
    </aside>
  )
}
