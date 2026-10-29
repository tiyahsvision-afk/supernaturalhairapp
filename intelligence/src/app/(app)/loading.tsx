export default function Loading() {
  return (
    <div aria-busy="true" aria-live="polite" className="animate-pulse space-y-4">
      <div className="h-8 w-1/3 rounded bg-paper-2" />
      <div className="h-4 w-2/3 rounded bg-paper-2" />
      <div className="grid gap-3 sm:grid-cols-3">{[0, 1, 2].map((i) => <div key={i} className="h-24 rounded-2xl bg-paper-2" />)}</div>
      <span className="sr-only">Loading…</span>
    </div>
  )
}
