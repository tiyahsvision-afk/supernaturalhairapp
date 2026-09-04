import { useEffect, useState, type ReactNode } from 'react'
import type { User } from 'firebase/auth'
import PageShell from '@/components/layout/PageShell'
import GlowCard from '@/components/layout/GlowCard'
import { OWNER_EMAIL, chatBackendConfigured } from '@/lib/chatConfig'
import { onAuthChanged, ownerSignIn } from '@/lib/chatBackend'

function NotConfiguredNotice() {
  return (
    <PageShell className="max-w-lg">
      <GlowCard>
        <p className="font-display text-lg font-bold text-ink-900">Not connected yet</p>
        <p className="mt-2 text-sm text-ink-900/60">
          Finish the Firebase setup (see FIREBASE_SETUP.md in the repo) and this page will come
          alive automatically.
        </p>
      </GlowCard>
    </PageShell>
  )
}

function SignInForm() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit() {
    setLoading(true)
    setError(null)
    const err = await ownerSignIn(email.trim(), password)
    setLoading(false)
    if (err) setError(err)
  }

  return (
    <PageShell className="flex justify-center">
      <GlowCard className="w-full max-w-sm">
        <p className="font-display text-lg font-bold text-ink-900">Owner sign in</p>
        <p className="mt-1 text-sm text-ink-900/60">Private — customers never see this page.</p>
        <div className="mt-5 space-y-3">
          <input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            type="email"
            placeholder="Email"
            className="w-full rounded-xl border border-ink-900/15 bg-ink-900/5 px-3 py-2.5 text-sm text-ink-900 placeholder:text-ink-900/30 outline-none focus:border-fuchsia-300"
          />
          <input
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            type="password"
            placeholder="Password"
            className="w-full rounded-xl border border-ink-900/15 bg-ink-900/5 px-3 py-2.5 text-sm text-ink-900 placeholder:text-ink-900/30 outline-none focus:border-fuchsia-300"
          />
          <button
            onClick={handleSubmit}
            disabled={loading || !email.trim() || !password}
            className="w-full rounded-full bg-gradient-to-r from-sky-400 via-fuchsia-400 to-lavender-400 py-2.5 text-sm font-semibold text-ink-950 disabled:opacity-40"
          >
            {loading ? 'Signing in…' : 'Sign in'}
          </button>
          {error && <p className="text-center text-xs text-fuchsia-600">{error}</p>}
        </div>
      </GlowCard>
    </PageShell>
  )
}

/** Gates a page behind Firebase owner sign-in. Renders children only once
 * signed in as OWNER_EMAIL. */
export default function OwnerGate({ children }: { children: ReactNode }) {
  const [checking, setChecking] = useState(true)
  const [user, setUser] = useState<User | null>(null)

  useEffect(() => {
    if (!chatBackendConfigured()) {
      setChecking(false)
      return
    }
    return onAuthChanged((u) => {
      setUser(u)
      setChecking(false)
    })
  }, [])

  if (!chatBackendConfigured()) return <NotConfiguredNotice />
  if (checking) return <PageShell>Loading…</PageShell>
  if (!user || user.email !== OWNER_EMAIL) return <SignInForm />
  return <>{children}</>
}
