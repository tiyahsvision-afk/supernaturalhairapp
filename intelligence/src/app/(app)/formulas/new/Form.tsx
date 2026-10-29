'use client'
import { useActionState } from 'react'
import { createFormulaAction } from '../actions'
import { LineEditor, type Option } from '../LineEditor'

export function NewFormulaForm({ options }: { options: Option[] }) {
  const [state, action, pending] = useActionState(createFormulaAction, undefined)
  return (
    <form action={action} className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <label className="text-sm"><span className="mb-1 block font-medium">Code *</span><input name="code" required placeholder="SN-F-0001" /></label>
        <label className="text-sm sm:col-span-2"><span className="mb-1 block font-medium">Name *</span><input name="name" required /></label>
        <label className="text-sm"><span className="mb-1 block font-medium">Category</span><input name="category" placeholder="shampoo, leave-in…" /></label>
        <label className="text-sm"><span className="mb-1 block font-medium">Application</span><select name="applicationType"><option>RINSE_OFF</option><option>LEAVE_ON</option><option>UNKNOWN</option></select></label>
        <label className="text-sm"><span className="mb-1 block font-medium">Target pH</span><input name="targetPh" inputMode="decimal" /></label>
        <label className="text-sm"><span className="mb-1 block font-medium">Visibility</span><select name="visibility"><option value="RESTRICTED">Restricted (formula roles in my org)</option><option value="CONFIDENTIAL_IP">Confidential IP</option><option value="ORGANIZATION">Whole organization</option></select></label>
        <label className="text-sm sm:col-span-2"><span className="mb-1 block font-medium">Intended goals (comma-separated)</span><input name="goals" /></label>
        <label className="inline-flex items-center gap-2 text-sm"><input type="checkbox" name="isSample" value="1" /> Mark as SAMPLE (illustrative)</label>
      </div>
      <LineEditor options={options} />
      <label className="block text-sm"><span className="mb-1 block font-medium">Notes</span><textarea name="notes" rows={2} /></label>
      {state?.error && <p role="alert" className="text-sm text-bad">{state.error}</p>}
      <button disabled={pending} className="rounded-full border border-brand bg-brand px-5 py-2 text-sm font-semibold text-[#0d2440]">{pending ? 'Saving…' : 'Create formula (v1, concept)'}</button>
    </form>
  )
}
