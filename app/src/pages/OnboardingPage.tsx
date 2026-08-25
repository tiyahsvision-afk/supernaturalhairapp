import { useState, type FormEvent } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import PageShell from '@/components/layout/PageShell'
import GlowCard from '@/components/layout/GlowCard'
import { useAppStore } from '@/store/useAppStore'

export default function OnboardingPage() {
  const onboarded = useAppStore((s) => s.onboarded)
  const completeOnboarding = useAppStore((s) => s.completeOnboarding)
  const navigate = useNavigate()

  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [hairGoal, setHairGoal] = useState('')
  const [submitted, setSubmitted] = useState(false)

  if (onboarded && !submitted) return <Navigate to="/app" replace />

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    completeOnboarding({ name: name.trim(), email: email.trim(), hairGoal: hairGoal.trim() })
    setSubmitted(true)
    navigate('/consultation')
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
          Takes about a minute. Everything here is editable later from your Profile page.
        </p>

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
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
          <div>
            <label className="mb-1 block text-sm font-medium text-ink-900/80" htmlFor="goal">
              What's your main hair goal right now?
            </label>
            <input
              id="goal"
              value={hairGoal}
              onChange={(e) => setHairGoal(e.target.value)}
              placeholder="e.g. Grow out my edges"
              className="w-full rounded-xl border border-ink-900/15 bg-ink-900/5 px-4 py-2.5 text-ink-900 placeholder:text-ink-900/30 outline-none focus:border-fuchsia-300"
            />
          </div>

          <button
            type="submit"
            className="w-full rounded-full bg-gradient-to-r from-sky-400 via-fuchsia-400 to-lavender-400 py-3 text-sm font-semibold text-ink-950 shadow-[0_0_30px_rgba(232,121,249,0.4)] transition-transform hover:scale-[1.02]"
          >
            Continue to my consultation
          </button>
        </form>
      </GlowCard>
    </PageShell>
  )
}
