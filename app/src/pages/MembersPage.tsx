import { Link } from 'react-router-dom'
import PageShell from '@/components/layout/PageShell'
import SectionHeading from '@/components/layout/SectionHeading'
import GlowCard from '@/components/layout/GlowCard'
import { MAGAZINE_ISSUES, MEMBERS_ONLY_PRODUCT, productPageUrl } from '@/lib/shopify'
import { useAppStore } from '@/store/useAppStore'

const COACHING_SESSIONS = [
  { title: 'Journey Coaching w/ Tia — group call', cadence: 'First Tuesday · 7:00 PM ET' },
  { title: 'In-person / virtual meetup', cadence: 'Third Saturday · 11:00 AM ET' },
  { title: 'Bible study & identity journey discussion', cadence: 'Every Sunday · 6:00 PM ET' },
]

const PERKS = [
  { icon: '🎓', title: 'Journey coaching with peers', body: 'Meet with our founder Tia and fellow members up to 4x monthly to talk through your holistic hair & identity journey.' },
  { icon: '🧕🏽', title: 'Meetups & discussions', body: 'In-person and virtual meetups built for real conversation, not just hair talk.' },
  { icon: '📖', title: 'Bible study', body: 'A weekly space to reflect on identity, faith, and growth alongside your hair journey.' },
  { icon: '🎤', title: 'Creator spotlights', body: 'Get interviewed and featured in the Supernatural Journey Magazine.' },
  { icon: '👕', title: 'Members-only merch', body: 'Limited drops made exclusively for club members.' },
]

export default function MembersPage() {
  const onboarded = useAppStore((s) => s.onboarded)
  const isClubMember = useAppStore((s) => s.profile.isClubMember)
  const joinClub = useAppStore((s) => s.joinClub)

  return (
    <PageShell>
      <SectionHeading
        eyebrow="Members Only"
        title="Join the club. Go deeper on the journey."
        description="Beyond the routine — coaching, community, and faith for the parts of the journey that aren't just about hair."
      />

      <GlowCard className="mt-10 flex flex-col items-center gap-6 bg-gradient-to-br from-lavender-500/15 via-transparent to-fuchsia-500/10 p-8 text-center sm:flex-row sm:text-left">
        <img
          src={MEMBERS_ONLY_PRODUCT.image}
          alt={MEMBERS_ONLY_PRODUCT.title}
          className="h-28 w-28 shrink-0 rounded-2xl object-cover"
        />
        <div className="flex-1">
          <h3 className="font-display text-xl font-bold text-ink-900">Supernatural Members Club</h3>
          <p className="mt-1 text-sm text-ink-900/60">Limited spots — journey coaching, meetups, Bible study & creator spotlights.</p>
          <p className="mt-2 text-lg font-semibold text-lavender-600">${MEMBERS_ONLY_PRODUCT.price.toFixed(0)}</p>
        </div>
        {isClubMember ? (
          <span className="shrink-0 rounded-full border border-emerald-400/40 bg-emerald-400/10 px-5 py-3 text-sm font-semibold text-emerald-600">
            ✓ You're a member
          </span>
        ) : onboarded ? (
          <div className="flex shrink-0 flex-col gap-2 sm:items-end">
            <button
              onClick={joinClub}
              className="rounded-full bg-gradient-to-r from-fuchsia-400 to-lavender-400 px-6 py-3 text-sm font-semibold text-ink-950 hover:scale-105 transition-transform"
            >
              Join the Club
            </button>
            <a
              href={productPageUrl(MEMBERS_ONLY_PRODUCT.handle)}
              target="_blank"
              rel="noreferrer"
              className="text-xs text-ink-900/40 hover:text-ink-900/70"
            >
              Complete purchase on shcbeauty.com →
            </a>
          </div>
        ) : (
          <Link
            to="/onboarding"
            className="shrink-0 rounded-full bg-gradient-to-r from-fuchsia-400 to-lavender-400 px-6 py-3 text-sm font-semibold text-ink-950 hover:scale-105 transition-transform"
          >
            Start your journey to join
          </Link>
        )}
      </GlowCard>

      <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {PERKS.map((p) => (
          <GlowCard key={p.title}>
            <div className="text-2xl">{p.icon}</div>
            <h3 className="mt-3 font-display text-base font-bold text-ink-900">{p.title}</h3>
            <p className="mt-2 text-sm text-ink-900/60">{p.body}</p>
          </GlowCard>
        ))}
      </div>

      {isClubMember && (
        <div className="mt-12">
          <h3 className="mb-4 font-display text-lg font-bold text-ink-900">Upcoming sessions</h3>
          <div className="space-y-2.5">
            {COACHING_SESSIONS.map((s) => (
              <GlowCard key={s.title} className="flex items-center justify-between !p-4">
                <span className="text-sm text-ink-900">{s.title}</span>
                <span className="text-xs text-ink-900/50">{s.cadence}</span>
              </GlowCard>
            ))}
          </div>
        </div>
      )}

      <div className="mt-12">
        <h3 className="mb-4 font-display text-lg font-bold text-ink-900">Creator spotlights & the Journey Magazine</h3>
        <div className="grid gap-5 sm:grid-cols-3">
          {MAGAZINE_ISSUES.map((issue) => (
            <a key={issue.handle} href={productPageUrl(issue.handle)} target="_blank" rel="noreferrer">
              <GlowCard className="h-full transition-transform hover:-translate-y-1">
                <img src={issue.image} alt={issue.title} className="h-32 w-full rounded-xl object-cover" loading="lazy" />
                <h4 className="mt-3 text-sm font-bold text-ink-900">{issue.title}</h4>
                <p className="mt-1 text-xs text-ink-900/55">{issue.blurb}</p>
              </GlowCard>
            </a>
          ))}
        </div>
      </div>
    </PageShell>
  )
}
