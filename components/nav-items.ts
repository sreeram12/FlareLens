import { Activity, Mic, ListOrdered, FileText, Salad } from 'lucide-react'

/**
 * Single source of truth for primary navigation (bottom nav + desktop sidebar).
 * Kept to 5 intent-based destinations (Hick's Law); Import is a one-time setup
 * action reachable from Today, not a primary destination.
 */
export const NAV_ITEMS = [
  { href: '/', label: 'Talk', icon: Mic },
  { href: '/today', label: 'Today', icon: Activity },
  { href: '/diet', label: 'Diet', icon: Salad },
  { href: '/timeline', label: 'Timeline', icon: ListOrdered },
  { href: '/report', label: 'Report', icon: FileText },
] as const
