import Link from 'next/link'
import { getDietGuidance } from '@/lib/actions'
import {
  AID_PRINCIPLES,
  ANTI_INFLAMMATORY_FOODS,
  PRO_INFLAMMATORY_FOODS,
  PHASES,
  type AidPhase,
} from '@/lib/ibd-aid'
import { Salad, Check, X, ArrowRight, Mic, Sparkles } from 'lucide-react'
import { cn } from '@/lib/utils'

export const dynamic = 'force-dynamic'

const ACCENT: Record<string, { text: string; bg: string; ring: string; dot: string }> = {
  emerald: { text: 'text-emerald-400', bg: 'bg-emerald-500/10', ring: 'border-emerald-500/30', dot: 'bg-emerald-400' },
  yellow: { text: 'text-yellow-400', bg: 'bg-yellow-500/10', ring: 'border-yellow-500/30', dot: 'bg-yellow-400' },
  orange: { text: 'text-orange-400', bg: 'bg-orange-500/10', ring: 'border-orange-500/30', dot: 'bg-orange-400' },
}

/**
 * Diet — the IBD-AID reference. Phase status lives on Today (AidPhaseCard) and
 * personalized food Q&A lives in the assistant; this page is the trustworthy
 * "what should I be eating" guide, led by what's actionable for the current phase.
 */
export default async function DietPage() {
  const { phase, phaseInfo } = await getDietGuidance()
  const accent = ACCENT[phaseInfo.accent]

  return (
    <main className="mx-auto max-w-md lg:max-w-3xl px-4 pb-24 pt-6">
      {/* Header */}
      <header className="mb-4">
        <div className="flex items-center gap-2 mb-1">
          <Salad className="h-5 w-5 text-emerald-400" />
          <h1 className="text-xl font-semibold text-foreground">Anti-Inflammatory Diet</h1>
        </div>
        <p className="text-sm text-muted-foreground text-pretty leading-relaxed">
          The IBD Anti-Inflammatory Diet (IBD-AID) — a phased, food-first guide to calming inflammation
          and supporting remission.
        </p>
      </header>

      {/* Low-key phase context (status itself lives on Today) */}
      <div className={cn('mb-6 flex items-center gap-2 rounded-lg border px-3 py-2', accent.ring, accent.bg)}>
        <Sparkles className={cn('h-3.5 w-3.5 shrink-0', accent.text)} />
        <p className="text-xs text-muted-foreground">
          Tailored to your <span className={cn('font-semibold', accent.text)}>{phaseInfo.name}</span> phase — set
          automatically from your recent stability score. Track your day-to-day balance on{' '}
          <Link href="/timeline" className="underline underline-offset-2 hover:text-foreground">Timeline</Link>.
        </p>
      </div>

      {/* What to emphasize now — most actionable, leads the page */}
      <section className="mb-6">
        <h3 className="text-sm font-semibold text-foreground mb-3">Eat more right now</h3>
        <div className="grid grid-cols-1 gap-2">
          {phaseInfo.emphasize.map((item, i) => (
            <div key={i} className="flex items-center gap-2.5 rounded-lg border border-emerald-500/20 bg-emerald-500/5 px-3 py-2.5">
              <Check className="h-4 w-4 text-emerald-400 shrink-0" strokeWidth={2.5} />
              <span className="text-sm text-foreground">{item}</span>
            </div>
          ))}
        </div>
      </section>

      {/* What to ease off */}
      <section className="mb-6">
        <h3 className="text-sm font-semibold text-foreground mb-3">Ease off for now</h3>
        <div className="grid grid-cols-1 gap-2">
          {phaseInfo.easeOff.map((item, i) => (
            <div key={i} className="flex items-center gap-2.5 rounded-lg border border-orange-500/20 bg-orange-500/5 px-3 py-2.5">
              <X className="h-4 w-4 text-orange-400 shrink-0" strokeWidth={2.5} />
              <span className="text-sm text-foreground">{item}</span>
            </div>
          ))}
        </div>
      </section>

      {/* Example meals */}
      <section className="mb-6">
        <h3 className="text-sm font-semibold text-foreground mb-3">Meal ideas for this phase</h3>
        <ul className="flex flex-col gap-2">
          {phaseInfo.exampleMeals.map((meal, i) => (
            <li key={i} className="flex items-start gap-2.5 rounded-lg border border-border bg-card px-3 py-2.5">
              <ArrowRight className={cn('h-4 w-4 shrink-0 mt-0.5', accent.text)} />
              <span className="text-sm text-foreground text-pretty">{meal}</span>
            </li>
          ))}
        </ul>
      </section>

      {/* Hand off personalized questions to the assistant */}
      <Link
        href="/talk"
        className="mb-7 flex items-center gap-3 rounded-xl border border-primary/30 bg-primary/5 px-4 py-3 transition-colors hover:bg-primary/10"
      >
        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/15">
          <Mic className="h-4 w-4 text-primary" />
        </div>
        <div className="flex-1">
          <p className="text-sm font-medium text-foreground">Wondering about a specific food?</p>
          <p className="text-xs text-muted-foreground">Ask FlareLens — it answers for your current phase.</p>
        </div>
        <ArrowRight className="h-4 w-4 text-primary" />
      </Link>

      {/* Phase journey */}
      <section className="mb-6">
        <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">The 3-phase journey</h3>
        <div className="flex flex-col gap-2">
          {([1, 2, 3] as AidPhase[]).map((p) => {
            const info = PHASES[p]
            const a = ACCENT[info.accent]
            const isCurrent = p === phase
            return (
              <div
                key={p}
                className={cn('rounded-lg border p-3 transition-colors', isCurrent ? cn(a.ring, a.bg) : 'border-border bg-card')}
              >
                <div className="flex items-center gap-2">
                  <span className={cn('flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold', a.bg, a.text)}>
                    {p}
                  </span>
                  <span className={cn('text-sm font-semibold', isCurrent ? a.text : 'text-foreground')}>
                    {info.shortName}
                  </span>
                  {isCurrent && (
                    <span className={cn('ml-auto text-[10px] font-medium uppercase tracking-wide', a.text)}>You are here</span>
                  )}
                </div>
                <p className="text-xs text-muted-foreground mt-1.5 pl-8">{info.appliesWhen}</p>
              </div>
            )
          })}
        </div>
      </section>

      {/* The 5 principles */}
      <section className="mb-6">
        <h3 className="text-sm font-semibold text-foreground mb-1">The 5 principles of IBD-AID</h3>
        <p className="text-xs text-muted-foreground mb-3">The framework behind every recommendation.</p>
        <div className="flex flex-col gap-2">
          {AID_PRINCIPLES.map((p, i) => (
            <div key={i} className="rounded-lg border border-border bg-card p-3">
              <div className="flex items-center gap-2 mb-1">
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary/15 text-[11px] font-bold text-primary">
                  {i + 1}
                </span>
                <span className="text-sm font-medium text-foreground">{p.title}</span>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed pl-7 text-pretty">{p.detail}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Food reference */}
      <section className="mb-2">
        <h3 className="text-sm font-semibold text-foreground mb-3">Food reference</h3>

        <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4 mb-3">
          <div className="flex items-center gap-2 mb-3">
            <Check className="h-4 w-4 text-emerald-400" strokeWidth={2.5} />
            <span className="text-sm font-semibold text-emerald-400">Anti-inflammatory</span>
          </div>
          <div className="flex flex-col gap-3">
            {ANTI_INFLAMMATORY_FOODS.map((g) => (
              <div key={g.group}>
                <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide mb-1.5">{g.group}</p>
                <div className="flex flex-wrap gap-1.5">
                  {g.items.map((item) => (
                    <span key={item} className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-xs text-foreground">
                      {item}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-xl border border-orange-500/20 bg-orange-500/5 p-4">
          <div className="flex items-center gap-2 mb-3">
            <X className="h-4 w-4 text-orange-400" strokeWidth={2.5} />
            <span className="text-sm font-semibold text-orange-400">Pro-inflammatory · limit these</span>
          </div>
          <div className="flex flex-col gap-3">
            {PRO_INFLAMMATORY_FOODS.map((g) => (
              <div key={g.group}>
                <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide mb-1.5">{g.group}</p>
                <div className="flex flex-wrap gap-1.5">
                  {g.items.map((item) => (
                    <span key={item} className="rounded-full bg-orange-500/10 px-2 py-0.5 text-xs text-foreground">
                      {item}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <p className="text-[11px] text-muted-foreground/70 text-center mt-5 text-pretty leading-relaxed">
        Guidance based on the IBD Anti-Inflammatory Diet (IBD-AID) framework. Always coordinate dietary
        changes with your care team — individual tolerances vary.
      </p>
    </main>
  )
}
