import { Activity, Mic, ListOrdered, FileText, Upload, type LucideIcon } from 'lucide-react'

export interface NavItem {
  href: string
  label: string
  icon: LucideIcon
  /** Shown only in the desktop sidebar (kept off the space-constrained mobile bar). */
  desktopOnly?: boolean
}

/**
 * Primary navigation. The mobile bottom bar stays lean (Hick's Law); the desktop
 * sidebar also surfaces Import. Diet is intentionally NOT here — it's a reference
 * page reached from the Today AID phase card and the assistant.
 */
export const NAV_ITEMS: NavItem[] = [
  { href: '/', label: 'Today', icon: Activity },
  { href: '/talk', label: 'Talk', icon: Mic },
  { href: '/timeline', label: 'Timeline', icon: ListOrdered },
  { href: '/imports', label: 'Import', icon: Upload, desktopOnly: true },
  { href: '/report', label: 'Report', icon: FileText },
]
