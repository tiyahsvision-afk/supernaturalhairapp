import GlowCard from '@/components/layout/GlowCard'

// Placeholder copy in Tia's voice, grounded in real brand facts (founded 2018,
// natural ingredients, faith + identity focus, the Beauty In Identity
// workbook). Swap in her real words and a real photo before this ships —
// replace the monogram div below with an <img> once you have one.
export default function FounderStory() {
  return (
    <section className="py-16">
      <div className="mx-auto max-w-5xl px-4 sm:px-6">
        <GlowCard className="flex flex-col items-center gap-8 p-8 text-center sm:flex-row sm:p-10 sm:text-left">
          <div className="grid h-28 w-28 shrink-0 place-items-center rounded-full bg-gradient-to-br from-sky-300 via-fuchsia-300 to-lavender-300 font-display text-4xl font-extrabold text-ink-900/80">
            T
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.25em] text-fuchsia-600">
              A note from our founder
            </p>
            <p className="mt-3 text-lg leading-relaxed text-ink-900/80">
              "I started Supernatural Hair Care in 2018 because I wanted more for our hair than
              just another product on a shelf. I wanted a place where you could work on your
              hair and your heart at the same time — where growth meant length AND becoming
              who you're made to be. This app is that place, built for you."
            </p>
            <p className="mt-4 font-display text-sm font-bold text-ink-900">— Tia, Founder</p>
          </div>
        </GlowCard>
      </div>
    </section>
  )
}
