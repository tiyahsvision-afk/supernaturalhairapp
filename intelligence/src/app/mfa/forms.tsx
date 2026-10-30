'use client'
import { useActionState } from 'react'
import { confirmEnrollmentAction, verifyMfaAction } from './actions'

function CodeForm({ action, label }: { action: (p: { error?: string } | undefined, f: FormData) => Promise<{ error?: string } | undefined>; label: string }) {
  const [state, act, pending] = useActionState(action, undefined)
  return (
    <form action={act} className="space-y-3">
      <label className="block text-sm"><span className="mb-1 block font-medium">6-digit code</span><input name="code" inputMode="numeric" pattern="\d{6}" autoComplete="one-time-code" required /></label>
      {state?.error && <p role="alert" className="text-sm text-bad">{state.error}</p>}
      <button type="submit" disabled={pending} className="w-full rounded-full border border-brand bg-brand px-4 py-2 text-sm font-semibold text-[#0d2440]">{label}</button>
    </form>
  )
}
export const VerifyForm = () => <CodeForm action={verifyMfaAction} label="Verify" />
export const EnrollForm = () => <CodeForm action={confirmEnrollmentAction} label="Enable two-factor authentication" />
