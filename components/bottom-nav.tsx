'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { NAV_ITEMS } from './nav-items'

export function BottomNav() {
  const pathname = usePathname()

  return (
    <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-50 border-t border-border bg-[var(--glass-bg)] backdrop-blur-xl">
      <div className="max-w-md mx-auto flex items-stretch">
        {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
          const isActive = pathname === href
          return (
            <Link
              key={href}
              href={href}
              className={`relative flex flex-1 flex-col items-center gap-1 py-3 px-2 text-xs transition-colors ${
                isActive ? 'text-primary' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {isActive && (
                <span className="absolute top-0 h-px w-8 bg-primary shadow-[0_0_10px_2px_oklch(var(--glow-color)/60%)]" />
              )}
              <Icon
                className={`h-5 w-5 transition-all ${isActive ? 'scale-110 text-glow' : ''}`}
                strokeWidth={isActive ? 2.5 : 1.8}
              />
              <span className={`font-medium ${isActive ? 'text-primary' : ''}`}>{label}</span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
