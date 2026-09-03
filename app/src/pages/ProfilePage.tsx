import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import PageShell from '@/components/layout/PageShell'
import SectionHeading from '@/components/layout/SectionHeading'
import GlowCard from '@/components/layout/GlowCard'
import NotificationToggle from '@/components/reminders/NotificationToggle'
import { useAppStore } from '@/store/useAppStore'

export default function ProfilePage() {
  const profile = useAppStore((s) => s.profile)
  const updateProfile = useAppStore((s) => s.updateProfile)
  const logOut = useAppStore((s) => s.logOut)
  const points = useAppStore((s) => s.pointsBalance())
  const consultationCount = useAppStore((s) => s.consultations.length)
  const photoCount = useAppStore((s) => s.photos.length)
  const navigate = useNavigate()

  const [name, setName] = useState(profile.name)
  const [email, setEmail] = useState(profile.email)
  const [hairGoal, setHairGoal] = useState(profile.hairGoal)
  const [savedFlash, setSavedFlash] = useState(false)

  function handleSave() {
    updateProfile({ name: name.trim(), email: email.trim(), hairGoal: hairGoal.trim() })
    setSavedFlash(true)
    setTimeout(() => setSavedFlash(false), 2000)
  }

  function handleLogOut() {
    logOut()
    navigate('/')
  }

  function handleReset() {
    if (confirm('Clear all local demo data (profile, schedule, photos, points)? This cannot be undone.')) {
      localStorage.removeItem('supernatural-journey-store')
      window.location.href = '/'
    }
  }

  return (
    <PageShell className="max-w-2xl">
      <SectionHeading eyebrow="Profile" title="Everything about you, editable" />

      <div className="mt-8 grid gap-4 sm:grid-cols-3">
        {[
          { label: 'Points', value: points },
          { label: 'Consultations', value: consultationCount },
          { label: 'Progress photos', value: photoCount },
        ].map((stat) => (
          <GlowCard key={stat.label} className="text-center !p-4">
            <p className="font-display text-2xl font-bold text-gradient">{stat.value}</p>
            <p className="text-xs text-ink-900/50">{stat.label}</p>
          </GlowCard>
        ))}
      </div>

      <GlowCard className="mt-6">
        <div className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-ink-900/80" htmlFor="p-name">
              Name
            </label>
            <input
              id="p-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-xl border border-ink-900/15 bg-ink-900/5 px-4 py-2.5 text-ink-900 outline-none focus:border-fuchsia-300"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-ink-900/80" htmlFor="p-email">
              Email
            </label>
            <input
              id="p-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-xl border border-ink-900/15 bg-ink-900/5 px-4 py-2.5 text-ink-900 outline-none focus:border-fuchsia-300"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-ink-900/80" htmlFor="p-goal">
              Hair goal
            </label>
            <input
              id="p-goal"
              value={hairGoal}
              onChange={(e) => setHairGoal(e.target.value)}
              className="w-full rounded-xl border border-ink-900/15 bg-ink-900/5 px-4 py-2.5 text-ink-900 outline-none focus:border-fuchsia-300"
            />
          </div>
          <button
            onClick={handleSave}
            className="rounded-full bg-gradient-to-r from-sky-400 via-fuchsia-400 to-lavender-400 px-6 py-2.5 text-sm font-semibold text-ink-950 hover:scale-105 transition-transform"
          >
            {savedFlash ? '✓ Saved' : 'Save changes'}
          </button>
        </div>
      </GlowCard>

      <div className="mt-6">
        <NotificationToggle />
      </div>

      <GlowCard className="mt-6 flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold text-ink-900">Your journey</p>
          <p className="text-xs text-ink-900/50">Thanks for being here.</p>
        </div>
        <span className="text-xs text-ink-900/40">Member since {new Date(profile.memberSince).toLocaleDateString()}</span>
      </GlowCard>

      <button
        onClick={handleLogOut}
        className="mt-10 w-full rounded-full border border-ink-900/15 py-2.5 text-sm font-semibold text-ink-900/80 hover:bg-ink-900/5"
      >
        Log out
      </button>

      <button onClick={handleReset} className="mt-4 text-xs text-ink-900/30 hover:text-fuchsia-600">
        Clear local demo data
      </button>
    </PageShell>
  )
}
