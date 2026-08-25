import { Link } from 'react-router-dom'
import { useAppStore } from '@/store/useAppStore'

export default function Hero() {
  const onboarded = useAppStore((s) => s.onboarded)

  return (
    <section className="relative overflow-hidden pb-20 pt-16 sm:pt-24">
      <div className="mx-auto max-w-5xl px-4 text-center sm:px-6">
        <div className="mx-auto mb-6 inline-flex items-center gap-2 rounded-full border border-ink-900/15 bg-ink-900/5 px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.2em] text-lavender-600">
          <span className="h-1.5 w-1.5 animate-pulse-glow rounded-full bg-fuchsia-400" />
          For every Supernatural Journey Kit owner
        </div>
        <h1 className="font-display text-4xl font-extrabold leading-[1.1] text-ink-900 sm:text-6xl">
          Your kit, guided.
          <br />
          <span className="text-gradient">A journey, personalized.</span>
        </h1>
        <p className="mx-auto mt-6 max-w-2xl text-base text-ink-900/70 sm:text-lg">
          Digital consultations, a routine scheduler built around your hairstyles, gentle
          reminders, progress photos, rewards, and a community walking the same identity
          journey — all built around your Supernatural Hair Care Journey Kit.
        </p>
        <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Link
            to={onboarded ? '/consultation' : '/onboarding'}
            className="w-full rounded-full bg-gradient-to-r from-sky-400 via-fuchsia-400 to-lavender-400 px-7 py-3 text-sm font-semibold text-ink-950 shadow-[0_0_35px_rgba(232,121,249,0.5)] transition-transform hover:scale-105 sm:w-auto"
          >
            Start Your Digital Consultation
          </Link>
          <Link
            to={onboarded ? '/scheduler' : '/onboarding'}
            className="w-full rounded-full border border-ink-900/20 bg-ink-900/5 px-7 py-3 text-sm font-semibold text-ink-900 backdrop-blur-md transition-colors hover:bg-ink-900/10 sm:w-auto"
          >
            Build My Scheduler
          </Link>
        </div>
        <p className="mt-4 text-xs text-ink-900/40">No app store download needed — everything lives right here.</p>
      </div>
    </section>
  )
}
