import SectionHeading from '@/components/layout/SectionHeading'
import GlowCard from '@/components/layout/GlowCard'

const FEATURES = [
  {
    title: 'Digital Consultation',
    body: 'Answer a few questions about your hair and scalp — get a personalized product-and-frequency plan you can update any time.',
  },
  {
    title: 'Smart Scheduler',
    body: 'Plan the days you use each product, log the hairstyles you’re wearing, and let the calendar keep your routine on track.',
  },
  {
    title: 'Reminders & Checklists',
    body: '"Hey, it’s time to use this oil" — gentle nudges you can check off as you go, right from your browser.',
  },
  {
    title: 'Progress Photos',
    body: 'Snap or upload a photo daily or weekly and watch your timeline build itself automatically.',
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
              <h3 className="font-display text-lg font-bold text-ink-900">{f.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-ink-900/65">{f.body}</p>
            </GlowCard>
          ))}
        </div>
      </div>
    </section>
  )
}
