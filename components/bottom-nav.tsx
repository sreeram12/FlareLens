'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Activity, Mic, ListOrdered, FileText, Upload } from 'lucide-react'

const navItems = [
  { href: '/', label: 'Talk', icon: Mic },
  { href: '/today', label: 'Today', icon: Activity },
  { href: '/timeline', label: 'Timeline', icon: ListOrdered },
  { href: '/imports', label: 'Import', icon: Upload },
  { href: '/report', label: 'Report', icon: FileText },
]

export function BottomNav() {
  const pathname = usePathname()

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-border bg-card/95 backdrop-blur-sm">
      <div className="max-w-md mx-auto flex items-stretch">
        {navItems.map(({ href, label, icon: Icon }) => {
          const isActive = pathname === href
          return (
            <Link
              key={href}
              href={href}
              className={`flex flex-1 flex-col items-center gap-1 py-3 px-2 text-xs transition-colors ${
                isActive
                  ? 'text-primary'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Icon
                className={`h-5 w-5 transition-all ${isActive ? 'scale-110' : ''}`}
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
