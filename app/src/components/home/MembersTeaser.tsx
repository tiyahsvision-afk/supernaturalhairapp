import { Link } from 'react-router-dom'
import GlowCard from '@/components/layout/GlowCard'

const PERKS = [
  'Journey coaching meetups with peers',
  'Members-only merch drops',
  'Bible study & identity-journey discussions',
  'Creator spotlights & Journey Magazine features',
]

export default function MembersTeaser() {
  return (
    <section className="py-16">
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <GlowCard className="flex flex-col items-center gap-8 overflow-hidden bg-gradient-to-br from-lavender-500/10 via-transparent to-fuchsia-500/10 p-8 text-center sm:p-12 lg:flex-row lg:text-left">
          <div className="flex-1">
            <p className="text-xs font-semibold uppercase tracking-[0.25em] text-lavender-600">
              Members Only
            </p>
            <h2 className="mt-2 font-display text-3xl font-extrabold text-ink-900">
              Join the club. Go deeper on the journey.
            </h2>
            <p className="mt-3 max-w-xl text-ink-900/70">
              Beyond the routine — meetups, coaching, community, and faith. The club is for
              the parts of the journey that aren't just about hair.
            </p>
            <Link
              to="/members"
              className="mt-6 inline-block rounded-full bg-gradient-to-r from-fuchsia-400 to-lavender-400 px-6 py-3 text-sm font-semibold text-ink-950 hover:scale-105 transition-transform"
            >
              Explore Membership
            </Link>
          </div>
          <ul className="flex-1 space-y-3 text-left">
            {PERKS.map((p) => (
              <li key={p} className="flex items-start gap-3 text-sm text-ink-900/80">
                <span className="mt-0.5 text-fuchsia-600">✦</span>
                {p}
              </li>
            ))}
          </ul>
        </GlowCard>
      </div>
    </section>
  )
}
