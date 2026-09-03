import PageShell from '@/components/layout/PageShell'
import SectionHeading from '@/components/layout/SectionHeading'
import GlowCard from '@/components/layout/GlowCard'

export default function TermsPage() {
  return (
    <PageShell className="max-w-3xl">
      <SectionHeading eyebrow="Legal" title="Terms of Service" />
      <GlowCard className="mt-8 space-y-5 text-sm leading-relaxed text-ink-900/75">
        <p>Last updated {new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long' })}.</p>

        <div>
          <h2 className="font-display text-base font-bold text-ink-900">What this app is</h2>
          <p className="mt-1">
            Supernatural Journey is a free companion app for Supernatural Hair Care
            customers — a digital consultation, scheduler, reminders, progress tracker, and
            community forum built around the Journey Kit product line.
          </p>
        </div>

        <div>
          <h2 className="font-display text-base font-bold text-ink-900">Not medical advice</h2>
          <p className="mt-1">
            The consultation and product suggestions are general hair-care guidance based on
            what you tell us — they aren't medical or dermatological advice. If you have a
            scalp condition or health concern, please talk to a doctor.
          </p>
        </div>

        <div>
          <h2 className="font-display text-base font-bold text-ink-900">Community forum</h2>
          <p className="mt-1">
            Be kind. Posts should stay on-topic and respectful. We may remove content that's
            abusive, spammy, or unrelated to hair care and this community.
          </p>
        </div>

        <div>
          <h2 className="font-display text-base font-bold text-ink-900">Changes</h2>
          <p className="mt-1">
            We may update this app and these terms over time as we add features. Continuing
            to use the app means you accept the current version of these terms.
          </p>
        </div>

        <div>
          <h2 className="font-display text-base font-bold text-ink-900">Contact</h2>
          <p className="mt-1">
            Questions?{' '}
            <a href="mailto:tiyahsvision@gmail.com" className="text-fuchsia-600 hover:underline">
              tiyahsvision@gmail.com
            </a>
            .
          </p>
        </div>
      </GlowCard>
    </PageShell>
  )
}
