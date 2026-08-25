import { Link } from 'react-router-dom'
import PageShell from '@/components/layout/PageShell'
import GlowCard from '@/components/layout/GlowCard'
import TodayChecklist from '@/components/reminders/TodayChecklist'
import NotificationToggle from '@/components/reminders/NotificationToggle'
import { useAppStore } from '@/store/useAppStore'
import { todayKey } from '@/lib/date'

const QUICK_LINKS = [
  { to: '/consultation', icon: '🔮', label: 'Consultation' },
  { to: '/scheduler', icon: '🗓️', label: 'Scheduler' },
  { to: '/progress', icon: '📸', label: 'Progress' },
  { to: '/reorder', icon: '🛍️', label: 'Reorder' },
  { to: '/rewards', icon: '✦', label: 'Rewards' },
  { to: '/members', icon: '👑', label: 'Members' },
  { to: '/forum', icon: '💬', label: 'Forum' },
]

export default function DashboardPage() {
  const name = useAppStore((s) => s.profile.name)
  const points = useAppStore((s) => s.pointsBalance())
  const latestConsultation = useAppStore((s) => s.consultations[0])
  const hairstyleToday = useAppStore((s) => s.hairstyles.find((h) => h.date === todayKey()))
  const firstName = name.split(' ')[0]

  return (
    <PageShell>
      <h1 className="font-display text-3xl font-bold text-white">
        Welcome back, <span className="text-gradient">{firstName || 'friend'}</span>
      </h1>
      <p className="mt-2 text-white/60">Here's where your journey stands today.</p>

      <div className="mt-8 grid gap-6 lg:grid-cols-[1.3fr,1fr]">
        <div className="space-y-6">
          <GlowCard>
            <div className="flex items-center justify-between">
              <h3 className="font-display text-lg font-bold text-white">Today</h3>
              {hairstyleToday && (
                <span className="rounded-full bg-sky-400/10 px-3 py-1 text-xs font-semibold text-sky-200">
                  💇🏾‍♀️ {hairstyleToday.name}
                </span>
              )}
            </div>
            <div className="mt-4">
              <TodayChecklist />
            </div>
          </GlowCard>

          {latestConsultation ? (
            <GlowCard>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-fuchsia-300">Your active plan</p>
              <p className="mt-2 text-sm text-white/70">{latestConsultation.summary}</p>
              <Link to="/consultation" className="mt-3 inline-block text-sm font-semibold text-fuchsia-300 hover:underline">
                View or update your consultation →
              </Link>
            </GlowCard>
          ) : (
            <GlowCard className="bg-gradient-to-br from-fuchsia-500/10 to-sky-500/10">
              <p className="font-display text-lg font-bold text-white">You haven't taken your consultation yet</p>
              <p className="mt-1 text-sm text-white/60">Get a personalized plan for your Journey Kit in under two minutes.</p>
              <Link
                to="/consultation"
                className="mt-3 inline-block rounded-full bg-gradient-to-r from-sky-400 via-fuchsia-400 to-lavender-400 px-5 py-2 text-sm font-semibold text-ink-950"
              >
                Start now
              </Link>
            </GlowCard>
          )}
        </div>

        <div className="space-y-6">
          <GlowCard className="text-center">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-fuchsia-300">Points</p>
            <p className="mt-1 font-display text-4xl font-extrabold text-gradient">{points}</p>
            <Link to="/rewards" className="mt-2 inline-block text-sm text-white/60 hover:text-white">
              View rewards →
            </Link>
          </GlowCard>
          <NotificationToggle />
        </div>
      </div>

      <div className="mt-10 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {QUICK_LINKS.map((l) => (
          <Link key={l.to} to={l.to}>
            <GlowCard className="flex flex-col items-center gap-2 !p-4 text-center transition-transform hover:-translate-y-1">
              <span className="text-2xl">{l.icon}</span>
              <span className="text-xs font-semibold text-white/80">{l.label}</span>
            </GlowCard>
          </Link>
        ))}
      </div>
    </PageShell>
  )
}
