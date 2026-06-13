'use client'

import { useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { runAnalysis } from '@/lib/actions'

/**
 * Triggers the background analyst once after the Today page mounts, then refreshes
 * so new findings appear. Runs as a server-action call (not during render), which
 * is where revalidation is allowed — keeps the page render read-only.
 */
export function AnalysisRefresher() {
  const router = useRouter()
  const ran = useRef(false)

  useEffect(() => {
    if (ran.current) return
    ran.current = true
    runAnalysis()
      .then(() => router.refresh())
      .catch(() => {
        /* non-fatal: stored findings already rendered */
      })
  }, [router])

  return null
}
