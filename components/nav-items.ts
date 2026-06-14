import { Activity, Mic, ListOrdered, FileText, Salad, Upload, type LucideIcon } from 'lucide-react'

export interface NavItem {
  href: string
  label: string
  icon: LucideIcon
  /** Shown only in the desktop sidebar (kept off the space-constrained mobile bar). */
  desktopOnly?: boolean
}

/**
 * Primary navigation. The mobile bottom bar stays lean (5 intent-based items,
 * Hick's Law); the desktop sidebar has room for Import too.
 */
export const NAV_ITEMS: NavItem[] = [
  { href: '/', label: 'Talk', icon: Mic },
  { href: '/today', label: 'Today', icon: Activity },
  { href: '/diet', label: 'Diet', icon: Salad },
  { href: '/timeline', label: 'Timeline', icon: ListOrdered },
  { href: '/imports', label: 'Import', icon: Upload, desktopOnly: true },
  { href: '/report', label: 'Report', icon: FileText },
]
