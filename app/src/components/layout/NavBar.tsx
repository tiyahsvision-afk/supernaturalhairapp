import { useState } from 'react'
import { Link, NavLink } from 'react-router-dom'
import { useAppStore } from '@/store/useAppStore'

const APP_LINKS = [
  { to: '/app', label: 'Dashboard' },
  { to: '/consultation', label: 'Consultation' },
  { to: '/scheduler', label: 'Scheduler' },
  { to: '/progress', label: 'Progress' },
  { to: '/reorder', label: 'Reorder' },
  { to: '/rewards', label: 'Rewards' },
  { to: '/members', label: 'Members' },
  { to: '/forum', label: 'Forum' },
]

export default function NavBar() {
  const [open, setOpen] = useState(false)
  const onboarded = useAppStore((s) => s.onboarded)
  const points = useAppStore((s) => s.pointsBalance())
  const name = useAppStore((s) => s.profile.name)

  return (
    <header className="sticky top-0 z-40 border-b border-white/10 bg-ink-900/70 backdrop-blur-xl">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6">
        <Link to="/" className="flex items-center gap-2 font-display text-lg font-extrabold tracking-tight">
          <span className="grid h-8 w-8 place-items-center rounded-xl bg-gradient-to-br from-sky-400 via-fuchsia-400 to-lavender-400 text-ink-950">
            ✦
          </span>
          <span className="text-gradient">Supernatural Journey</span>
        </Link>

        <nav className="hidden items-center gap-1 lg:flex">
          {onboarded &&
            APP_LINKS.map((link) => (
              <NavLink
                key={link.to}
                to={link.to}
                className={({ isActive }) =>
                  `rounded-full px-3 py-1.5 text-sm font-medium transition-colors ${
                    isActive
                      ? 'bg-white/10 text-white'
                      : 'text-white/60 hover:bg-white/5 hover:text-white'
                  }`
                }
              >
                {link.label}
              </NavLink>
            ))}
        </nav>

        <div className="hidden items-center gap-3 lg:flex">
          {onboarded ? (
            <>
              <Link
                to="/rewards"
                className="rounded-full border border-fuchsia-300/30 bg-fuchsia-400/10 px-3 py-1.5 text-sm font-semibold text-fuchsia-200"
              >
                ✦ {points} pts
              </Link>
              <Link
                to="/profile"
                className="rounded-full border border-white/15 px-3 py-1.5 text-sm font-medium text-white/80 hover:text-white"
              >
                {name ? name.split(' ')[0] : 'Profile'}
              </Link>
            </>
          ) : (
            <Link
              to="/onboarding"
              className="rounded-full bg-gradient-to-r from-sky-400 via-fuchsia-400 to-lavender-400 px-4 py-2 text-sm font-semibold text-ink-950 shadow-[0_0_25px_rgba(232,121,249,0.45)] transition-transform hover:scale-105"
            >
              Start Your Journey
            </Link>
          )}
        </div>

        <button
          onClick={() => setOpen((v) => !v)}
          className="grid h-9 w-9 place-items-center rounded-lg border border-white/15 text-white lg:hidden"
          aria-label="Toggle menu"
        >
          {open ? '✕' : '☰'}
        </button>
      </div>

      {open && (
        <div className="border-t border-white/10 bg-ink-900/95 px-4 pb-4 lg:hidden">
          <nav className="flex flex-col gap-1 pt-2">
            {onboarded &&
              APP_LINKS.map((link) => (
                <NavLink
                  key={link.to}
                  to={link.to}
                  onClick={() => setOpen(false)}
                  className={({ isActive }) =>
                    `rounded-lg px-3 py-2 text-sm font-medium ${
                      isActive ? 'bg-white/10 text-white' : 'text-white/70'
                    }`
                  }
                >
                  {link.label}
                </NavLink>
              ))}
            {onboarded && (
              <NavLink
                to="/profile"
                onClick={() => setOpen(false)}
                className="rounded-lg px-3 py-2 text-sm font-medium text-white/70"
              >
                Profile · ✦ {points} pts
              </NavLink>
            )}
            {!onboarded && (
              <Link
                to="/onboarding"
                onClick={() => setOpen(false)}
                className="mt-2 rounded-full bg-gradient-to-r from-sky-400 via-fuchsia-400 to-lavender-400 px-4 py-2 text-center text-sm font-semibold text-ink-950"
              >
                Start Your Journey
              </Link>
            )}
          </nav>
        </div>
      )}
    </header>
  )
}
