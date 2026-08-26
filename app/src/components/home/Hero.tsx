import { Link } from 'react-router-dom'
import { useAppStore } from '@/store/useAppStore'

export default function Hero() {
  const onboarded = useAppStore((s) => s.onboarded)

  return (
    <section className="relative overflow-hidden pb-20 pt-16 sm:pt-24">
      <div className="mx-auto max-w-5xl px-4 text-center sm:px-6">
        <div className="mx-auto mb-6 inline-flex items-center gap-2 rounded-full border border-ink-900/15 bg-ink-900/5 px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.2em] text-lavender-600">
          <span className="h-1.5 w-1.5 animate-pulse-glow rounded-full bg-fuchsia-400" />
          A home for your hair journey and your identity journey
        </div>
        <h1 className="font-display text-4xl font-extrabold leading-[1.1] text-ink-900 sm:text-6xl">
          You're not just growing hair.
          <br />
          <span className="text-gradient">You're growing into you.</span>
        </h1>
        <p className="mx-auto mt-6 max-w-2xl text-base text-ink-900/70 sm:text-lg">
          Your Supernatural Journey Kit comes with a place to belong — a personal plan for
          your hair, a community that gets it, and a little faith and sisterhood built
          right in. This is where the rest of your journey happens.
        </p>
        <div className="mt-9 flex flex-col items-center justify-center">
          <Link
            to={onboarded ? '/consultation' : '/onboarding'}
            className="w-full max-w-xs rounded-full bg-gradient-to-r from-sky-400 via-fuchsia-400 to-lavender-400 px-8 py-4 text-base font-semibold text-ink-950 shadow-[0_0_35px_rgba(232,121,249,0.5)] transition-transform hover:scale-105 sm:w-auto"
          >
            Start Your Digital Consultation — Free
          </Link>
          <p className="mt-3 text-xs text-ink-900/45">Takes about 2 minutes · no download · nothing to buy</p>
          <Link
            to={onboarded ? '/scheduler' : '/onboarding'}
            className="mt-4 text-sm font-medium text-ink-900/50 underline decoration-ink-900/20 underline-offset-4 hover:text-ink-900"
          >
            or jump straight to building my scheduler →
          </Link>
        </div>
      </div>
    </section>
  )
}
