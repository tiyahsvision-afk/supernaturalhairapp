import { Link } from 'react-router-dom'
import { SHOP_DOMAIN } from '@/lib/shopify'

export default function Footer() {
  return (
    <footer className="mt-24 border-t border-ink-900/10 bg-lavender-50/60">
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6">
        <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <p className="font-display text-lg font-extrabold text-gradient">Supernatural Journey</p>
            <p className="mt-2 max-w-xs text-sm text-ink-900/60">
              Your companion app for the Supernatural Hair Care Journey Kit — consultation,
              scheduling, reminders, progress, and community, all in one place.
            </p>
          </div>
          <div>
            <p className="mb-3 text-sm font-semibold text-ink-900/80">Your Journey</p>
            <ul className="space-y-2 text-sm text-ink-900/60">
              <li><Link to="/consultation" className="hover:text-ink-900">Digital Consultation</Link></li>
              <li><Link to="/scheduler" className="hover:text-ink-900">Scheduler</Link></li>
              <li><Link to="/progress" className="hover:text-ink-900">Progress Photos</Link></li>
              <li><Link to="/reorder" className="hover:text-ink-900">Reorder</Link></li>
            </ul>
          </div>
          <div>
            <p className="mb-3 text-sm font-semibold text-ink-900/80">Community</p>
            <ul className="space-y-2 text-sm text-ink-900/60">
              <li><Link to="/forum" className="hover:text-ink-900">Forum</Link></li>
              <li><Link to="/rewards" className="hover:text-ink-900">Rewards</Link></li>
            </ul>
          </div>
          <div>
            <p className="mb-3 text-sm font-semibold text-ink-900/80">Shop</p>
            <ul className="space-y-2 text-sm text-ink-900/60">
              <li>
                <a href={`https://${SHOP_DOMAIN}`} target="_blank" rel="noreferrer" className="hover:text-ink-900">
                  {SHOP_DOMAIN}
                </a>
              </li>
            </ul>
          </div>
        </div>
        <p className="mt-10 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-ink-900/40">
          <span>© {new Date().getFullYear()} Supernatural Hair Care. Made for the Journey Kit community.</span>
          <Link to="/privacy" className="hover:text-ink-900">Privacy Policy</Link>
          <Link to="/terms" className="hover:text-ink-900">Terms of Service</Link>
        </p>
      </div>
    </footer>
  )
}
