'use client'
import { useActionState } from 'react'
import { signupAction } from './actions'

const MODES = [['FOUNDER', 'Beauty founder'], ['CHEMIST', 'Cosmetic chemist / formulator'], ['BRAND', 'Beauty brand'], ['MANUFACTURER', 'Manufacturer']] as const

export function SignupForm() {
  const [state, act, pending] = useActionState(signupAction, undefined)
  return (
    <form action={act} className="space-y-4">
      <label className="block text-sm"><span className="mb-1 block font-medium">Your name</span><input name="name" autoComplete="name" required /></label>
      <label className="block text-sm"><span className="mb-1 block font-medium">Work email</span><input name="email" type="email" autoComplete="username" required /></label>
      <label className="block text-sm"><span className="mb-1 block font-medium">Password</span><input name="password" type="password" autoComplete="new-password" required minLength={12} /><span className="mt-1 block text-xs text-ink-3">At least 12 characters, using three of: lowercase, uppercase, numbers, symbols.</span></label>
      <label className="block text-sm"><span className="mb-1 block font-medium">Organization or brand</span><input name="organization" autoComplete="organization" required /></label>
      <fieldset className="text-sm"><legend className="mb-1 font-medium">I am a…</legend><div className="grid gap-1.5">{MODES.map(([v, l], i) => <label key={v} className="inline-flex items-center gap-2"><input type="radio" name="mode" value={v} defaultChecked={i === 0} />{l}</label>)}</div></fieldset>
      <label className="flex items-start gap-2 text-xs text-ink-2"><input type="checkbox" name="terms" className="mt-0.5" />I understand this platform provides research decision support only — not finished formulations, safety assessments, regulatory approval or legal advice.</label>
      {state?.error && <p role="alert" className="text-sm text-bad">{state.error}</p>}
      <button type="submit" disabled={pending} className="w-full rounded-full border border-brand bg-brand px-4 py-2 text-sm font-semibold text-[#0d2440] disabled:opacity-60">{pending ? 'Creating your workspace…' : 'Create workspace'}</button>
    </form>
  )
}
