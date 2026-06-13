'use client'

import { useState } from 'react'
import { Mic, Camera } from 'lucide-react'
import { cn } from '@/lib/utils'
import { VoiceLogger } from './voice-logger'
import { PhotoLogger } from './photo-logger'

type Mode = 'voice' | 'photo'

const MODES = [
  { id: 'voice' as const, label: 'Voice', icon: Mic },
  { id: 'photo' as const, label: 'Photo', icon: Camera },
]

/**
 * Top-level logging surface. Voice is the primary path; Photo is the richer
 * option for meals. Both run extraction → editable preview → save, and the
 * voice path also offers a structured manual form as backup.
 */
export function LogSurface() {
  const [mode, setMode] = useState<Mode>('voice')

  return (
    <div className="flex flex-col gap-4">
      <div className="flex gap-1 rounded-lg border border-border bg-card p-1">
        {MODES.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setMode(id)}
            className={cn(
              'flex-1 flex items-center justify-center gap-1.5 rounded-md py-2 text-sm font-medium transition-colors',
              mode === id ? 'bg-primary/15 text-primary' : 'text-muted-foreground hover:text-foreground'
            )}
          >
            <Icon className="h-4 w-4" strokeWidth={mode === id ? 2.4 : 1.9} />
            {label}
          </button>
        ))}
      </div>

      {mode === 'voice' ? <VoiceLogger /> : <PhotoLogger />}
    </div>
  )
}
