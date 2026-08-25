import GlowCard from '@/components/layout/GlowCard'
import { useAppStore } from '@/store/useAppStore'

const EARN_ACTIONS = [
  { icon: '📸', label: 'Share a progress photo', points: 50 },
  { icon: '🔮', label: 'Complete or update your consultation', points: 25 },
  { icon: '🤝', label: 'Refer a friend who joins', points: 150 },
  { icon: '👑', label: 'Join the Members Club', points: 100 },
]

export default function PointsHero() {
  const points = useAppStore((s) => s.pointsBalance())

  return (
    <GlowCard className="bg-gradient-to-br from-fuchsia-500/10 via-transparent to-sky-500/10">
      <p className="text-xs font-semibold uppercase tracking-[0.25em] text-fuchsia-300">Your balance</p>
      <p className="mt-2 font-display text-5xl font-extrabold text-gradient">{points}</p>
      <p className="text-sm text-white/50">points ready to redeem on your next order</p>

      <div className="mt-6 grid gap-2 sm:grid-cols-2">
        {EARN_ACTIONS.map((a) => (
          <div key={a.label} className="flex items-center justify-between rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2.5">
            <span className="flex items-center gap-2 text-sm text-white/75">
              <span>{a.icon}</span>
              {a.label}
            </span>
            <span className="text-xs font-semibold text-fuchsia-200">+{a.points}</span>
          </div>
        ))}
      </div>
    </GlowCard>
  )
}
