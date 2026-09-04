import PageShell from '@/components/layout/PageShell'
import SectionHeading from '@/components/layout/SectionHeading'
import GlowCard from '@/components/layout/GlowCard'

export default function PrivacyPage() {
  return (
    <PageShell className="max-w-3xl">
      <SectionHeading eyebrow="Legal" title="Privacy Policy" />
      <GlowCard className="mt-8 space-y-5 text-sm leading-relaxed text-ink-900/75">
        <p>Last updated {new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long' })}.</p>

        <div>
          <h2 className="font-display text-base font-bold text-ink-900">What we collect</h2>
          <p className="mt-1">
            When you start your journey, we ask for your name and email — either typed in
            directly or, if you choose "Continue with Google," pulled from your Google
            account. If you use the digital consultation, scheduler, or progress photos,
            those answers, schedule entries, and photos are saved as well.
          </p>
        </div>

        <div>
          <h2 className="font-display text-base font-bold text-ink-900">Where it's stored</h2>
          <p className="mt-1">
            Your day-to-day schedule and progress photos stay stored locally in your own
            browser — they aren't uploaded anywhere. Your name, email, hair goal, and a
            summary of your consultation are synced securely to Firebase (a Google service)
            once you start your journey, so Tia can see how the app is being used. If you
            message us through the chat bubble, that conversation is stored the same way.
            Only you and Tia can read your own data — no other customer can see it.
          </p>
        </div>

        <div>
          <h2 className="font-display text-base font-bold text-ink-900">How it's used</h2>
          <p className="mt-1">
            We use this information to run your personalized routine inside the app, to
            understand how customers are using it, and to reply to messages you send us. We
            don't sell your information, and we don't share it with advertisers.
          </p>
        </div>

        <div>
          <h2 className="font-display text-base font-bold text-ink-900">Your control</h2>
          <p className="mt-1">
            You can edit your profile any time from the Profile page, log out to stop your
            local session, or use "Clear local demo data" there to erase everything stored
            in your browser.
          </p>
        </div>

        <div>
          <h2 className="font-display text-base font-bold text-ink-900">Contact</h2>
          <p className="mt-1">
            Questions about your data? Email{' '}
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
