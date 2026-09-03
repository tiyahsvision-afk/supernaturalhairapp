import { useState, type FormEvent } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import PageShell from '@/components/layout/PageShell'
import GlowCard from '@/components/layout/GlowCard'
import { chatBackendConfigured } from '@/lib/chatConfig'
import { useAppStore } from '@/store/useAppStore'

export default function OnboardingPage() {
  const onboarded = useAppStore((s) => s.onboarded)
  const completeOnboarding = useAppStore((s) => s.completeOnboarding)
  const navigate = useNavigate()

  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const [googleLoading, setGoogleLoading] = useState(false)
  const [googleError, setGoogleError] = useState<string | null>(null)

  if (onboarded && !submitted) return <Navigate to="/app" replace />

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    completeOnboarding({ name: name.trim(), email: email.trim(), hairGoal: '' })
    setSubmitted(true)
    navigate('/consultation')
  }

  async function handleGoogleSignIn() {
    setGoogleLoading(true)
    setGoogleError(null)
    try {
      const backend = await import('@/lib/chatBackend')
      const result = await backend.signInWithGoogle()
      if (!result) {
        setGoogleError('Could not sign in with Google — try again, or use email below.')
        return
      }
      completeOnboarding({ name: result.name, email: result.email, hairGoal: '' })
      setSubmitted(true)
      navigate('/consultation')
    } finally {
      setGoogleLoading(false)
    }
  }

  return (
    <PageShell className="flex justify-center">
      <GlowCard className="w-full max-w-lg">
        <p className="text-xs font-semibold uppercase tracking-[0.25em] text-fuchsia-600">
          Welcome to the journey
        </p>
        <h1 className="mt-2 font-display text-2xl font-bold text-ink-900">
          Let's set up your profile
        </h1>
        <p className="mt-2 text-sm text-ink-900/60">
          Takes about 30 seconds. Everything here is editable later from your Profile page.
        </p>

        {chatBackendConfigured() && (
          <>
            <button
              type="button"
              onClick={handleGoogleSignIn}
              disabled={googleLoading}
              className="mt-6 flex w-full items-center justify-center gap-2.5 rounded-full border border-ink-900/15 bg-white py-3 text-sm font-semibold text-ink-900 shadow-sm transition-transform hover:scale-[1.01] disabled:cursor-not-allowed disabled:opacity-60"
            >
              <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
                <path
                  fill="#4285F4"
                  d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.9c1.7-1.57 2.7-3.88 2.7-6.62Z"
                />
                <path
                  fill="#34A853"
                  d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.9-2.26c-.8.54-1.84.86-3.06.86-2.35 0-4.34-1.59-5.05-3.72H.96v2.33A9 9 0 0 0 9 18Z"
                />
                <path
                  fill="#FBBC05"
                  d="M3.95 10.7A5.4 5.4 0 0 1 3.67 9c0-.59.1-1.17.28-1.7V4.97H.96A9 9 0 0 0 0 9c0 1.45.35 2.83.96 4.03l2.99-2.33Z"
                />
                <path
                  fill="#EA4335"
                  d="M9 3.58c1.32 0 2.51.46 3.44 1.35l2.58-2.58C13.46.89 11.43 0 9 0A9 9 0 0 0 .96 4.97l2.99 2.33C4.66 5.17 6.65 3.58 9 3.58Z"
                />
              </svg>
              {googleLoading ? 'Signing in…' : 'Continue with Google'}
            </button>
            {googleError && <p className="mt-2 text-center text-xs text-red-500">{googleError}</p>}
            <div className="my-5 flex items-center gap-3">
              <div className="h-px flex-1 bg-ink-900/10" />
              <span className="text-xs text-ink-900/40">or</span>
              <div className="h-px flex-1 bg-ink-900/10" />
            </div>
          </>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-ink-900/80" htmlFor="name">
              Your name
            </label>
            <input
              id="name"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Amara Johnson"
              className="w-full rounded-xl border border-ink-900/15 bg-ink-900/5 px-4 py-2.5 text-ink-900 placeholder:text-ink-900/30 outline-none focus:border-fuchsia-300"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-ink-900/80" htmlFor="email">
              Email
            </label>
            <input
              id="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@email.com"
              className="w-full rounded-xl border border-ink-900/15 bg-ink-900/5 px-4 py-2.5 text-ink-900 placeholder:text-ink-900/30 outline-none focus:border-fuchsia-300"
            />
          </div>
          <button
            type="submit"
            className="w-full rounded-full bg-gradient-to-r from-sky-400 via-fuchsia-400 to-lavender-400 py-3 text-sm font-semibold text-ink-950 shadow-[0_0_30px_rgba(232,121,249,0.4)] transition-transform hover:scale-[1.02]"
          >
            Continue to my consultation
          </button>
          <p className="text-center text-xs text-ink-900/40">Just for your journey here — we won't spam you.</p>
        </form>
      </GlowCard>
    </PageShell>
  )
}
