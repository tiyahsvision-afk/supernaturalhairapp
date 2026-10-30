'use client'
import { useActionState, type ReactNode } from 'react'

/** Form bound to a server action that returns { error } on failure; inputs keep their values when an error is shown. */
export function ActionForm({ action, children, submitLabel, pendingLabel = 'Working…', className = 'space-y-4' }: { action: (prev: { error?: string } | undefined, fd: FormData) => Promise<{ error?: string } | undefined>; children: ReactNode; submitLabel: string; pendingLabel?: string; className?: string }) {
  const [state, act, pending] = useActionState(action, undefined)
  return (
    <form action={act} className={className}>
      {children}
      {state?.error && <p role="alert" className="rounded-xl border border-bad/40 bg-paper-2 px-3 py-2 text-sm text-bad">{state.error}</p>}
      <button type="submit" disabled={pending} className="rounded-full border border-brand bg-brand px-5 py-2 text-sm font-semibold text-[#0d2440] hover:bg-brand-200 disabled:opacity-60">{pending ? pendingLabel : submitLabel}</button>
    </form>
  )
}

export function PrintButton() {
  return <button type="button" onClick={() => window.print()} className="rounded-full border border-brand bg-brand px-4 py-1.5 text-sm font-semibold text-[#0d2440] print:hidden">Download PDF</button>
}
