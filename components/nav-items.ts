import { Activity, Mic, ListOrdered, FileText, Upload, Salad } from 'lucide-react'

/** Single source of truth for primary navigation (bottom nav + desktop sidebar). */
export const NAV_ITEMS = [
  { href: '/', label: 'Talk', icon: Mic },
  { href: '/today', label: 'Today', icon: Activity },
  { href: '/diet', label: 'Diet', icon: Salad },
  { href: '/timeline', label: 'Timeline', icon: ListOrdered },
  { href: '/imports', label: 'Import', icon: Upload },
  { href: '/report', label: 'Report', icon: FileText },
] as const
