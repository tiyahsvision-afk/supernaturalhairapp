'use client'
import { useActionState } from 'react'
import { newVersionAction, setStatusAction } from '../actions'
import { LineEditor, type Option } from '../LineEditor'

const STATUSES = ['CONCEPT', 'RESEARCH_CANDIDATE', 'CHEMIST_REVIEW', 'PROTOTYPE', 'STABILITY_TESTING', 'COMPATIBILITY_TESTING', 'SAFETY_ASSESSMENT', 'APPROVED_FOR_CONTROLLED_STUDY', 'APPROVED_FOR_MANUFACTURING', 'RETIRED']

export function StatusForm({ formulaId, versionId, current }: { formulaId: string; versionId: string; current: string }) {
  const [state, action, pending] = useActionState(setStatusAction, undefined)
  return (
    <form action={action} className="space-y-2 text-sm">
      <input type="hidden" name="formulaId" value={formulaId} /><input type="hidden" name="versionId" value={versionId} />
      <select name="status" defaultValue={current}>{STATUSES.map((s) => <option key={s} value={s}>{s.replace(/_/g, ' ').toLowerCase()}</option>)}</select>
      <input name="reason" placeholder="Reason (recorded in history)" required />
      <button disabled={pending} className="rounded-full border border-line px-4 py-1.5">Update status</button>
      {state?.error && <p role="alert" className="text-bad">{state.error}</p>}
      {state?.ok && <p className="text-good">{state.ok}</p>}
      <p className="text-xs text-ink-3">Choosing “chemist review” opens a review task for a cosmetic chemist. Prototype and later stages are blocked until that review is approved.</p>
    </form>
  )
}

export function VersionForm({ formulaId, fromVersionId, options, initial }: { formulaId: string; fromVersionId: string; options: Option[]; initial: { ref: string; pct: string; phase: string; role: string }[] }) {
  const [state, action, pending] = useActionState(newVersionAction, undefined)
  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="formulaId" value={formulaId} /><input type="hidden" name="fromVersionId" value={fromVersionId} />
      <LineEditor options={options} initial={initial} />
      <input name="notes" placeholder="What changed and why" />
      {state?.error && <p role="alert" className="text-sm text-bad">{state.error}</p>}
      <button disabled={pending} className="rounded-full border border-brand bg-brand px-4 py-1.5 text-sm font-medium text-[#0d2440]">Save as new version (previous version is locked)</button>
    </form>
  )
}
