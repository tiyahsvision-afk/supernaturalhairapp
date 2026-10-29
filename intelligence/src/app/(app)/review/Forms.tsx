'use client'
import { useActionState } from 'react'
import { decideAction, identityDecisionAction } from './actions'

export function DecisionForm({ taskId }: { taskId: string }) {
  const [state, action, pending] = useActionState(decideAction, undefined)
  return (
    <form action={action} className="flex flex-wrap items-center gap-1">
      <input type="hidden" name="taskId" value={taskId} />
      <input name="notes" placeholder="Notes / reason" className="w-48 py-1 text-xs" />
      {(['APPROVED', 'CHANGES_REQUESTED', 'REJECTED'] as const).map((d) => <button key={d} name="decision" value={d} disabled={pending} className="rounded-full border border-line px-2 py-0.5 text-xs">{d === 'APPROVED' ? 'Approve' : d === 'REJECTED' ? 'Reject' : 'Request changes'}</button>)}
      {state?.error && <span role="alert" className="text-xs text-bad">{state.error}</span>}
      {state?.ok && <span className="text-xs text-good">{state.ok}</span>}
    </form>
  )
}

export function IdentityForm({ candidateId }: { candidateId: string }) {
  const [state, action, pending] = useActionState(identityDecisionAction, undefined)
  return (
    <form action={action} className="flex flex-wrap gap-1">
      <input type="hidden" name="candidateId" value={candidateId} />
      <select name="decision" className="w-auto py-1 text-xs">{['DIFFERENT_INGREDIENT', 'RELATED_INGREDIENT', 'SALT_OR_DERIVATIVE', 'MIXTURE_CONTAINING', 'SAME_INGREDIENT', 'UNRESOLVED'].map((d) => <option key={d} value={d}>{d.replace(/_/g, ' ').toLowerCase()}</option>)}</select>
      <input name="notes" placeholder="Reason (required)" required className="w-48 py-1 text-xs" />
      <button disabled={pending} className="rounded-full border border-line px-2 py-0.5 text-xs">Decide</button>
      {state?.error && <span role="alert" className="text-xs text-bad">{state.error}</span>}
    </form>
  )
}
