'use client'

import { useState } from 'react'
import { saveLogEntry } from '@/lib/actions'
import { CheckCircle2, Loader2 } from 'lucide-react'

type EntryType = 'bowel_movement' | 'symptom' | 'meal' | 'medication' | 'sleep' | 'exercise'

interface ManualLogFormProps {
  onSaved: () => void
}

export function ManualLogForm({ onSaved }: ManualLogFormProps) {
  const [type, setType] = useState<EntryType>('symptom')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  // Symptom state
  const [pain, setPain] = useState(0)
  const [fatigue, setFatigue] = useState(0)
  const [bloating, setBloating] = useState(0)
  const [nausea, setNausea] = useState(0)
  const [notes, setNotes] = useState('')

  // BM state
  const [bmCount, setBmCount] = useState(1)
  const [urgency, setUrgency] = useState(0)
  const [blood, setBlood] = useState(false)
  const [consistency, setConsistency] = useState('formed')

  // Meal state
  const [description, setDescription] = useState('')
  const [calories, setCalories] = useState('')
  const [triggerFoods, setTriggerFoods] = useState(false)

  // Sleep state
  const [sleepHours, setSleepHours] = useState(7)
  const [sleepQuality, setSleepQuality] = useState(7)

  // Exercise state
  const [exerciseType, setExerciseType] = useState('Walk')
  const [duration, setDuration] = useState(30)
  const [steps, setSteps] = useState(0)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)

    let data: Record<string, unknown> = {}
    if (type === 'symptom') {
      data = { pain_scale: pain, fatigue, bloating, nausea, notes }
    } else if (type === 'bowel_movement') {
      data = { count: bmCount, urgency, blood, consistency }
    } else if (type === 'meal') {
      data = { description, calories: parseInt(calories) || 0, trigger_foods: triggerFoods }
    } else if (type === 'sleep') {
      data = { duration_hours: sleepHours, quality: sleepQuality }
    } else if (type === 'exercise') {
      data = { type: exerciseType, duration_minutes: duration, steps }
    }

    await saveLogEntry(type, data, undefined, 'manual')
    setSaving(false)
    setSaved(true)
    setTimeout(onSaved, 1500)
  }

  if (saved) {
    return (
      <div className="flex flex-col items-center gap-3 py-8">
        <CheckCircle2 className="h-10 w-10 text-emerald-400" />
        <p className="text-sm font-semibold text-emerald-400">Entry saved!</p>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      {/* Type selector */}
      <div>
        <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide block mb-1.5">Type</label>
        <div className="flex flex-wrap gap-1.5">
          {(['symptom', 'bowel_movement', 'meal', 'sleep', 'exercise'] as EntryType[]).map(t => (
            <button
              type="button"
              key={t}
              onClick={() => setType(t)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium border transition-colors ${
                type === t
                  ? 'bg-primary/20 border-primary/50 text-primary'
                  : 'bg-card border-border text-muted-foreground hover:text-foreground'
              }`}
            >
              {t === 'bowel_movement' ? 'BM' : t.charAt(0).toUpperCase() + t.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Symptom fields */}
      {type === 'symptom' && (
        <div className="flex flex-col gap-3">
          {[
            { label: 'Pain', value: pain, set: setPain },
            { label: 'Fatigue', value: fatigue, set: setFatigue },
            { label: 'Bloating', value: bloating, set: setBloating },
            { label: 'Nausea', value: nausea, set: setNausea },
          ].map(({ label, value, set }) => (
            <div key={label}>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs text-muted-foreground">{label}</label>
                <span className="text-xs font-semibold text-foreground">{value}/10</span>
              </div>
              <input type="range" min={0} max={10} value={value}
                onChange={e => set(parseInt(e.target.value))}
                className="w-full accent-primary" />
            </div>
          ))}
          <textarea
            value={notes} onChange={e => setNotes(e.target.value)}
            placeholder="Notes (optional)"
            className="rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground resize-none h-16 focus:outline-none focus:ring-1 focus:ring-primary/50"
          />
        </div>
      )}

      {/* BM fields */}
      {type === 'bowel_movement' && (
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-3">
            <label className="text-xs text-muted-foreground w-24">Count</label>
            <input type="number" min={1} max={20} value={bmCount}
              onChange={e => setBmCount(parseInt(e.target.value))}
              className="w-20 text-sm rounded border border-border bg-background px-2 py-1 text-foreground focus:outline-none focus:ring-1 focus:ring-primary/50" />
          </div>
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs text-muted-foreground">Urgency</label>
              <span className="text-xs font-semibold text-foreground">{urgency}/10</span>
            </div>
            <input type="range" min={0} max={10} value={urgency}
              onChange={e => setUrgency(parseInt(e.target.value))}
              className="w-full accent-primary" />
          </div>
          <div className="flex items-center gap-3">
            <label className="text-xs text-muted-foreground w-24">Consistency</label>
            <select value={consistency} onChange={e => setConsistency(e.target.value)}
              className="flex-1 text-sm rounded border border-border bg-background px-2 py-1.5 text-foreground focus:outline-none">
              <option value="formed">Formed</option>
              <option value="semi-formed">Semi-formed</option>
              <option value="loose">Loose</option>
              <option value="watery">Watery</option>
            </select>
          </div>
          <label className="flex items-center gap-2 text-sm text-foreground cursor-pointer">
            <input type="checkbox" checked={blood} onChange={e => setBlood(e.target.checked)} className="accent-red-400" />
            Blood present
          </label>
        </div>
      )}

      {/* Meal fields */}
      {type === 'meal' && (
        <div className="flex flex-col gap-3">
          <input type="text" value={description} onChange={e => setDescription(e.target.value)}
            placeholder="What did you eat?"
            className="rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/50" />
          <div className="flex items-center gap-3">
            <label className="text-xs text-muted-foreground w-24">Calories</label>
            <input type="number" value={calories} onChange={e => setCalories(e.target.value)}
              placeholder="approx."
              className="flex-1 text-sm rounded border border-border bg-background px-2 py-1 text-foreground focus:outline-none focus:ring-1 focus:ring-primary/50" />
          </div>
          <label className="flex items-center gap-2 text-sm text-foreground cursor-pointer">
            <input type="checkbox" checked={triggerFoods} onChange={e => setTriggerFoods(e.target.checked)} className="accent-orange-400" />
            Included trigger foods
          </label>
        </div>
      )}

      {/* Sleep fields */}
      {type === 'sleep' && (
        <div className="flex flex-col gap-3">
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs text-muted-foreground">Duration</label>
              <span className="text-xs font-semibold text-foreground">{sleepHours}h</span>
            </div>
            <input type="range" min={2} max={12} step={0.5} value={sleepHours}
              onChange={e => setSleepHours(parseFloat(e.target.value))}
              className="w-full accent-primary" />
          </div>
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs text-muted-foreground">Quality</label>
              <span className="text-xs font-semibold text-foreground">{sleepQuality}/10</span>
            </div>
            <input type="range" min={1} max={10} value={sleepQuality}
              onChange={e => setSleepQuality(parseInt(e.target.value))}
              className="w-full accent-primary" />
          </div>
        </div>
      )}

      {/* Exercise fields */}
      {type === 'exercise' && (
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-3">
            <label className="text-xs text-muted-foreground w-24">Type</label>
            <select value={exerciseType} onChange={e => setExerciseType(e.target.value)}
              className="flex-1 text-sm rounded border border-border bg-background px-2 py-1.5 text-foreground focus:outline-none">
              <option>Walk</option><option>Run</option><option>Cycling</option>
              <option>Yoga</option><option>Swimming</option><option>Strength</option>
            </select>
          </div>
          <div className="flex items-center gap-3">
            <label className="text-xs text-muted-foreground w-24">Duration (min)</label>
            <input type="number" value={duration} onChange={e => setDuration(parseInt(e.target.value))}
              className="w-20 text-sm rounded border border-border bg-background px-2 py-1 text-foreground focus:outline-none" />
          </div>
          <div className="flex items-center gap-3">
            <label className="text-xs text-muted-foreground w-24">Steps</label>
            <input type="number" value={steps} onChange={e => setSteps(parseInt(e.target.value))}
              className="w-24 text-sm rounded border border-border bg-background px-2 py-1 text-foreground focus:outline-none" />
          </div>
        </div>
      )}

      <button
        type="submit"
        disabled={saving}
        className="flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground disabled:opacity-50 hover:bg-primary/90 transition-colors"
      >
        {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Save Entry'}
      </button>
    </form>
  )
}
