import { useState } from 'react'
import GlowCard from '@/components/layout/GlowCard'
import { useAppStore } from '@/store/useAppStore'

const TIERS = [
  { points: 250, reward: '$5 off your next order' },
  { points: 500, reward: '$10 off your next order' },
  { points: 1000, reward: '$20 off + free Massage Brush' },
]

export default function RedeemTiers() {
  const points = useAppStore((s) => s.pointsBalance())
  const redeemPoints = useAppStore((s) => s.redeemPoints)
  const [redeemedCode, setRedeemedCode] = useState<string | null>(null)

  function handleRedeem(tierPoints: number, reward: string) {
    const ok = redeemPoints(tierPoints, `Redeemed: ${reward}`)
    if (ok) {
      setRedeemedCode(`JOURNEY-${Math.random().toString(36).slice(2, 8).toUpperCase()}`)
    }
  }

  return (
    <GlowCard>
      <h3 className="font-display text-lg font-bold text-ink-900">Redeem your points</h3>
      <div className="mt-4 space-y-2.5">
        {TIERS.map((tier) => {
          const canRedeem = points >= tier.points
          return (
            <div
              key={tier.points}
              className="flex items-center justify-between rounded-xl border border-ink-900/10 bg-ink-900/[0.03] px-4 py-3"
            >
              <div>
                <p className="text-sm font-semibold text-ink-900">{tier.reward}</p>
                <p className="text-xs text-ink-900/45">{tier.points} points</p>
              </div>
              <button
                onClick={() => handleRedeem(tier.points, tier.reward)}
                disabled={!canRedeem}
                className="rounded-full border border-ink-900/20 px-4 py-1.5 text-xs font-semibold text-ink-900 disabled:opacity-30"
              >
                Redeem
              </button>
            </div>
          )
        })}
      </div>

      {redeemedCode && (
        <div className="mt-4 rounded-xl border border-emerald-400/30 bg-emerald-400/10 px-4 py-3 text-sm text-emerald-600">
          🎉 Your code: <code className="font-semibold">{redeemedCode}</code> — enter it at checkout on shcbeauty.com
        </div>
      )}

      <p className="mt-4 text-xs text-ink-900/35">
        Demo mode: codes generate locally here. Launch-ready version wires this button to a real
        Shopify discount via the Admin API.
      </p>
    </GlowCard>
  )
}
