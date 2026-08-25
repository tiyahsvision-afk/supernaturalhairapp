import GlowCard from '@/components/layout/GlowCard'
import { useAppStore } from '@/store/useAppStore'

export default function RewardLedger() {
  const events = useAppStore((s) => s.rewardEvents)

  return (
    <GlowCard>
      <h3 className="font-display text-lg font-bold text-white">Activity</h3>
      {events.length === 0 ? (
        <p className="mt-2 text-sm text-white/50">Your points activity will show up here.</p>
      ) : (
        <div className="mt-3 max-h-80 space-y-1.5 overflow-y-auto pr-1">
          {events.map((e) => (
            <div key={e.id} className="flex items-center justify-between py-1.5 text-sm">
              <div>
                <p className="text-white/80">{e.note}</p>
                <p className="text-xs text-white/35">{new Date(e.createdAt).toLocaleDateString()}</p>
              </div>
              <span className={`shrink-0 font-semibold ${e.points >= 0 ? 'text-emerald-300' : 'text-fuchsia-300'}`}>
                {e.points >= 0 ? '+' : ''}
                {e.points}
              </span>
            </div>
          ))}
        </div>
      )}
    </GlowCard>
  )
}
