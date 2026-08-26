import { Link } from 'react-router-dom'
import { useAppStore } from '@/store/useAppStore'

/** Thumb-reachable CTA bar for mobile visitors who haven't started yet. */
export default function StickyMobileCta() {
  const onboarded = useAppStore((s) => s.onboarded)
  if (onboarded) return null

  return (
    <div className="fixed inset-x-0 bottom-0 z-30 border-t border-ink-900/10 bg-white/90 p-3 backdrop-blur-lg sm:hidden">
      <Link
        to="/onboarding"
        className="block w-full rounded-full bg-gradient-to-r from-sky-400 via-fuchsia-400 to-lavender-400 py-3 text-center text-sm font-semibold text-ink-950 shadow-[0_0_25px_rgba(232,121,249,0.4)]"
      >
        Start Your Journey — Free
      </Link>
    </div>
  )
}
