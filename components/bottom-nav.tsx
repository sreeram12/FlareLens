'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { NAV_ITEMS } from './nav-items'
import { cn } from '@/lib/utils'

export function BottomNav() {
  const pathname = usePathname()
  const items = NAV_ITEMS.filter((i) => !i.desktopOnly)
  const activeIndex = items.findIndex((i) => i.href === pathname)
  const n = items.length

  return (
    <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-50 border-t border-border bg-[var(--glass-bg)] backdrop-blur-xl">
      <div className="relative mx-auto flex max-w-md items-stretch">
        {/* Sliding active indicator (glowing tick) — continuity between tabs */}
        {activeIndex >= 0 && (
          <span
            aria-hidden
            className="pointer-events-none absolute top-0 transition-transform duration-[260ms] ease-out motion-reduce:transition-none"
            style={{ width: `${100 / n}%`, transform: `translateX(${activeIndex * 100}%)` }}
          >
            <span className="absolute left-1/2 top-0 h-0.5 w-8 -translate-x-1/2 rounded-full bg-primary shadow-[0_0_10px_2px_oklch(var(--glow-color)/60%)]" />
          </span>
        )}

        {items.map(({ href, label, icon: Icon }) => {
          const isActive = pathname === href
          return (
            <Link
              key={href}
              href={href}
              aria-current={isActive ? 'page' : undefined}
              className={cn(
                'relative flex flex-1 flex-col items-center gap-1 rounded-lg px-2 py-3 text-xs transition-colors active:scale-[0.96] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]',
                isActive ? 'text-primary' : 'text-muted-foreground hover:text-foreground'
              )}
            >
              <Icon
                className={cn('h-5 w-5 transition-transform duration-200 ease-out motion-reduce:transition-none', isActive && 'scale-110 text-glow')}
                strokeWidth={isActive ? 2.5 : 1.8}
              />
              <span className={cn('font-medium', isActive && 'text-primary')}>{label}</span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
