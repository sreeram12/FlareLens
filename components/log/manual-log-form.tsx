'use client'

import { useState } from 'react'
import { saveLogEntry } from '@/lib/actions'
import { CheckCircle2, Loader2 } from 'lucide-react'
import {
  MEAL_TYPES,
  PORTIONS,
  EXERCISE_TYPES,
  EXERCISE_FOCUS,
  INTENSITIES,
  type MealType,
  type Portion,
  type Intensity,
} from '@/lib/health/log-schema'
import { FOOD_CLASSES, IBD_FOOD_TAGS, type FoodClass } from '@/lib/ibd-aid'
import { TagChips } from './tag-chips'

type EntryType = 'bowel_movement' | 'symptom' | 'meal' | 'medication' | 'sleep' | 'exercise'

const TAG_SUGGESTIONS = IBD_FOOD_TAGS.map((t) => ({ id: t.id, label: t.label }))

function prettify(s: string): string {
  return s.replace(/[-_]/g, ' ').replace(/^\w/, (c) => c.toUpperCase())
}

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

  // Meal state (anti-inflammatory diet aware)
  const [description, setDescription] = useState('')
  const [mealType, setMealType] = useState<MealType>('lunch')
  const [portion, setPortion] = useState<Portion>('medium')
  const [foodClass, setFoodClass] = useState<FoodClass>('neutral')
  const [tags, setTags] = useState<string[]>([])

  // Sleep state
  const [sleepHours, setSleepHours] = useState(7)
  const [sleepQuality, setSleepQuality] = useState(7)

  // Exercise state
  const [exerciseType, setExerciseType] = useState('walk')
  const [focus, setFocus] = useState('')
  const [duration, setDuration] = useState(30)
  const [intensity, setIntensity] = useState<Intensity>('moderate')
  const [rpe, setRpe] = useState(5)
  const [postWorkoutFatigue, setPostWorkoutFatigue] = useState(0)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)

    let data: Record<string, unknown> = {}
    if (type === 'symptom') {
      data = { pain_scale: pain, fatigue, bloating, nausea, notes }
    } else if (type === 'bowel_movement') {
      data = { count: bmCount, urgency, blood, consistency }
    } else if (type === 'meal') {
      data = {
        description,
        meal_type: mealType,
        portion,
        food_class: foodClass,
        tags,
      }
    } else if (type === 'sleep') {
      data = { duration_hours: sleepHours, quality: sleepQuality }
    } else if (type === 'exercise') {
      data = {
        type: exerciseType,
        focus: focus || undefined,
        duration_minutes: duration,
        intensity,
        rpe,
        post_workout_fatigue: postWorkoutFatigue,
      }
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
            <label className="text-xs text-muted-foreground w-24">Meal</label>
            <select value={mealType} onChange={e => setMealType(e.target.value as MealType)}
              className="flex-1 text-sm rounded border border-border bg-background px-2 py-1.5 text-foreground focus:outline-none">
              {MEAL_TYPES.map(m => <option key={m} value={m}>{prettify(m)}</option>)}
            </select>
          </div>
          <div className="flex items-center gap-3">
            <label className="text-xs text-muted-foreground w-24">Portion</label>
            <select value={portion} onChange={e => setPortion(e.target.value as Portion)}
              className="flex-1 text-sm rounded border border-border bg-background px-2 py-1.5 text-foreground focus:outline-none">
              {PORTIONS.map(p => <option key={p} value={p}>{prettify(p)}</option>)}
            </select>
          </div>
          <div className="flex items-center gap-3">
            <label className="text-xs text-muted-foreground w-24">Inflammation</label>
            <select value={foodClass} onChange={e => setFoodClass(e.target.value as FoodClass)}
              className="flex-1 text-sm rounded border border-border bg-background px-2 py-1.5 text-foreground focus:outline-none">
              {FOOD_CLASSES.map(c => <option key={c} value={c}>{prettify(c)}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs text-muted-foreground block mb-1.5">IBD tags</label>
            <TagChips value={tags} suggestions={TAG_SUGGESTIONS} onChange={setTags} />
          </div>
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
              {EXERCISE_TYPES.map(t => <option key={t} value={t}>{prettify(t)}</option>)}
            </select>
          </div>
          <div className="flex items-center gap-3">
            <label className="text-xs text-muted-foreground w-24">Focus</label>
            <select value={focus} onChange={e => setFocus(e.target.value)}
              className="flex-1 text-sm rounded border border-border bg-background px-2 py-1.5 text-foreground focus:outline-none">
              <option value="">—</option>
              {EXERCISE_FOCUS.map(f => <option key={f} value={f}>{prettify(f)}</option>)}
            </select>
          </div>
          <div className="flex items-center gap-3">
            <label className="text-xs text-muted-foreground w-24">Duration (min)</label>
            <input type="number" value={duration} onChange={e => setDuration(parseInt(e.target.value) || 0)}
              className="w-20 text-sm rounded border border-border bg-background px-2 py-1 text-foreground focus:outline-none" />
          </div>
          <div className="flex items-center gap-3">
            <label className="text-xs text-muted-foreground w-24">Intensity</label>
            <select value={intensity} onChange={e => setIntensity(e.target.value as Intensity)}
              className="flex-1 text-sm rounded border border-border bg-background px-2 py-1.5 text-foreground focus:outline-none">
              {INTENSITIES.map(i => <option key={i} value={i}>{prettify(i)}</option>)}
            </select>
          </div>
          {[
            { label: 'Effort (RPE)', value: rpe, set: setRpe },
            { label: 'Post-workout fatigue', value: postWorkoutFatigue, set: setPostWorkoutFatigue },
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
