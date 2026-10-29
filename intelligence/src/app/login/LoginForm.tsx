'use client'
import { useActionState } from 'react'
import { loginAction } from './actions'

export function LoginForm() {
  const [state, action, pending] = useActionState(loginAction, undefined)
  return (
    <form action={action} className="space-y-4">
      <label className="block text-sm"><span className="mb-1 block font-medium">Email</span><input name="email" type="email" autoComplete="username" required /></label>
      <label className="block text-sm"><span className="mb-1 block font-medium">Password</span><input name="password" type="password" autoComplete="current-password" required /></label>
      {state?.error && <p role="alert" className="text-sm text-bad">{state.error}</p>}
      <button type="submit" disabled={pending} className="w-full rounded-full border border-brand bg-brand px-4 py-2 text-sm font-semibold text-[#0d2440] hover:bg-brand-200 disabled:opacity-60">{pending ? 'Signing in…' : 'Sign in'}</button>
    </form>
  )
}
