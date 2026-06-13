import { VoiceLogger } from '@/components/log/voice-logger'

export default function LogPage() {
  return (
    <div className="flex flex-col gap-4 px-4 pt-6 pb-4">
      <div>
        <h1 className="text-xl font-semibold text-foreground">Voice Log</h1>
        <p className="text-sm text-muted-foreground mt-0.5 leading-relaxed">
          Describe how you&apos;re feeling in your own words.
        </p>
      </div>
      <VoiceLogger />
    </div>
  )
}
