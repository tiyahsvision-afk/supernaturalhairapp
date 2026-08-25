import { useState } from 'react'
import GlowCard from '@/components/layout/GlowCard'
import { useAppStore } from '@/store/useAppStore'

export default function ReferralBox() {
  const referralCode = useAppStore((s) => s.profile.referralCode)
  const addRewardEvent = useAppStore((s) => s.addRewardEvent)
  const [copied, setCopied] = useState(false)
  const [friendCode, setFriendCode] = useState('')
  const [message, setMessage] = useState('')

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(referralCode)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      setMessage('Copy this manually: ' + referralCode)
    }
  }

  function handleRedeemFriendCode() {
    const code = friendCode.trim().toUpperCase()
    if (!code) return
    if (code === referralCode) {
      setMessage("That's your own code — share it with a friend instead!")
      return
    }
    addRewardEvent('referral', 150, `Referral credited for code ${code}`)
    setMessage('+150 points added for your referral 🎉')
    setFriendCode('')
  }

  return (
    <GlowCard>
      <h3 className="font-display text-lg font-bold text-white">Refer a friend</h3>
      <p className="mt-1 text-sm text-white/60">
        Share your code. When a friend joins with it, you both get rewarded.
      </p>

      <div className="mt-4 flex items-center gap-2">
        <code className="flex-1 truncate rounded-xl border border-white/15 bg-ink-950/60 px-3 py-2.5 text-sm text-lavender-200">
          {referralCode}
        </code>
        <button
          onClick={handleCopy}
          className="shrink-0 rounded-xl border border-white/20 px-4 py-2.5 text-sm font-semibold text-white hover:bg-white/10"
        >
          {copied ? '✓ Copied' : 'Copy'}
        </button>
      </div>

      <div className="mt-5 border-t border-white/10 pt-4">
        <label className="mb-1 block text-xs font-medium text-white/60" htmlFor="friend-code">
          Have a friend's referral code?
        </label>
        <div className="flex gap-2">
          <input
            id="friend-code"
            value={friendCode}
            onChange={(e) => setFriendCode(e.target.value)}
            placeholder="e.g. AMARA-3F9K"
            className="flex-1 rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-white/30 outline-none focus:border-fuchsia-300"
          />
          <button
            onClick={handleRedeemFriendCode}
            className="rounded-xl bg-gradient-to-r from-sky-400 to-fuchsia-400 px-4 py-2 text-sm font-semibold text-ink-950"
          >
            Apply
          </button>
        </div>
        {message && <p className="mt-2 text-xs text-lavender-200">{message}</p>}
      </div>
    </GlowCard>
  )
}
