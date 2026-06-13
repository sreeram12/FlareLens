import type { Metadata, Viewport } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { BottomNav } from '@/components/bottom-nav'
import { SideNav } from '@/components/side-nav'

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' })

export const metadata: Metadata = {
  title: "FlareLens — Crohn's Health Tracker",
  description: "Personal Crohn's disease health tracker with AI-powered voice logging, stability scoring, and doctor-ready reports.",
  keywords: ["Crohn's disease", 'IBD', 'health tracker', 'flare tracking'],
}

export const viewport: Viewport = {
  themeColor: '#0d1117',
  width: 'device-width',
  initialScale: 1,
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    // suppressHydrationWarning: browser extensions (password managers, Grammarly,
    // Dark Reader, etc.) mutate <html>/<body> attributes before React hydrates.
    // This only suppresses attribute diffs on these elements, not their children.
    <html lang="en" className={`${inter.variable} bg-background`} suppressHydrationWarning>
      <body
        className="bg-background text-foreground antialiased min-h-screen font-sans"
        suppressHydrationWarning
      >
        <SideNav />
        {/* Mobile: full-width column + bottom nav. Desktop: offset for the sidebar
            with a comfortably wider, centered content column. */}
        <main className="min-h-screen pb-24 lg:pb-10 lg:pl-60">
          <div className="mx-auto w-full max-w-md lg:max-w-3xl">
            {children}
          </div>
        </main>
        <BottomNav />
      </body>
    </html>
  )
}
