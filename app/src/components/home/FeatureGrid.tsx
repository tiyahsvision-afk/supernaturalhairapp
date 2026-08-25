import SectionHeading from '@/components/layout/SectionHeading'
import GlowCard from '@/components/layout/GlowCard'

const FEATURES = [
  {
    icon: '🔮',
    title: 'Digital Consultation',
    body: 'Answer a few questions about your hair and scalp — get a personalized product-and-frequency plan you can update any time.',
  },
  {
    icon: '🗓️',
    title: 'Smart Scheduler',
    body: 'Plan the days you use each product, log the hairstyles you’re wearing, and let the calendar keep your routine on track.',
  },
  {
    icon: '🔔',
    title: 'Reminders & Checklists',
    body: '"Hey, it’s time to use this oil" — gentle nudges you can check off as you go, right from your browser.',
  },
  {
    icon: '📸',
    title: 'Progress Photos',
    body: 'Snap or upload a photo daily or weekly and watch your timeline build itself automatically.',
  },
  {
    icon: '🛍️',
    title: 'One-Tap Reorder',
    body: 'Out of an oil? Reorder the full kit or a single product in one tap, linked straight to the Supernatural shop.',
  },
  {
    icon: '✦',
    title: 'Rewards Program',
    body: 'Earn points for sharing photos, referring friends, and staying consistent — redeem them on your next order.',
  },
  {
    icon: '👑',
    title: 'Members Club',
    body: 'Journey coaching, meetups, Bible study, and creator spotlights for members going deeper on the journey.',
  },
  {
    icon: '💬',
    title: 'Community Forum',
    body: 'Share wins, ask questions, and talk about your supernatural experiences with people on the same path.',
  },
]

export default function FeatureGrid() {
  return (
    <section className="py-16">
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <SectionHeading
          eyebrow="Everything in one place"
          title="Built around your kit, start to finish"
          description="From the moment you open the box to your hundredth wash day."
          align="center"
        />
        <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {FEATURES.map((f) => (
            <GlowCard key={f.title} className="transition-transform hover:-translate-y-1">
              <div className="text-2xl">{f.icon}</div>
              <h3 className="mt-3 font-display text-lg font-bold text-ink-900">{f.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-ink-900/65">{f.body}</p>
            </GlowCard>
          ))}
        </div>
      </div>
    </section>
  )
}
