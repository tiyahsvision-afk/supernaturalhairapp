'use client'
import { useActionState } from 'react'
import { changePasswordAction, createApiKeyAction, createUserAction } from './actions'

export function CreateUserForm({ roles, orgs }: { roles: { value: string; label: string }[]; orgs: { id: string; name: string }[] }) {
  const [state, action, pending] = useActionState(createUserAction, undefined)
  return (
    <form action={action} className="grid gap-2 sm:grid-cols-4">
      <input name="name" placeholder="Name" required /><input name="email" type="email" placeholder="Email" required /><input name="password" type="password" placeholder="Initial password (≥12 chars)" required />
      <select name="organizationId">{orgs.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}</select>
      <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs sm:col-span-4">{roles.map((r) => <label key={r.value} className="inline-flex items-center gap-1"><input type="checkbox" name="roles" value={r.value} />{r.label}</label>)}</div>
      <button disabled={pending} className="rounded-full border border-line px-4 py-1.5 text-sm">Create user</button>
      {state?.error && <p role="alert" className="text-sm text-bad sm:col-span-3">{state.error}</p>}{state?.ok && <p className="text-sm text-good sm:col-span-3">{state.ok}</p>}
    </form>
  )
}

export function ApiKeyForm({ scopes }: { scopes: string[] }) {
  const [state, action, pending] = useActionState(createApiKeyAction, undefined)
  return (
    <form action={action} className="space-y-2">
      <div className="grid gap-2 sm:grid-cols-3"><input name="name" placeholder="Key name" required /><select name="days" defaultValue="90"><option value="30">30 days</option><option value="90">90 days</option><option value="365">365 days</option></select><button disabled={pending} className="rounded-full border border-line px-4 py-1.5 text-sm">Create key</button></div>
      <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs">{scopes.map((s) => <label key={s} className="inline-flex items-center gap-1"><input type="checkbox" name="scopes" value={s} />{s}</label>)}</div>
      {state?.error && <p role="alert" className="text-sm text-bad">{state.error}</p>}
      {state?.key && <div className="rounded-lg border border-line bg-paper-2 p-3 text-sm"><strong>Copy this key now — it will not be shown again:</strong><code className="mt-1 block break-all">{state.key}</code></div>}
    </form>
  )
}

export function PasswordForm() {
  const [state, action, pending] = useActionState(changePasswordAction, undefined)
  return (
    <form action={action} className="grid gap-2 sm:grid-cols-3">
      <input name="current" type="password" placeholder="Current password" required autoComplete="current-password" /><input name="next" type="password" placeholder="New password" required autoComplete="new-password" />
      <button disabled={pending} className="rounded-full border border-line px-4 py-1.5 text-sm">Change password</button>
      {state?.error && <p role="alert" className="text-sm text-bad sm:col-span-3">{state.error}</p>}{state?.ok && <p className="text-sm text-good sm:col-span-3">{state.ok}</p>}
    </form>
  )
}
