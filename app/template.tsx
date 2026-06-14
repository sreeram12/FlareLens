// Re-rendered on every navigation: gives routes a calm settle-in instead of a
// hard cut (Doherty / perceived continuity). Disabled under reduced-motion.
export default function Template({ children }: { children: React.ReactNode }) {
  return (
    <div className="duration-200 ease-out animate-in fade-in-0 slide-in-from-bottom-1 motion-reduce:animate-none">
      {children}
    </div>
  )
}
