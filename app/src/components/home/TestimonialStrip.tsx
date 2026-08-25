import SectionHeading from '@/components/layout/SectionHeading'
import GlowCard from '@/components/layout/GlowCard'
import { TESTIMONIALS } from '@/lib/testimonials'

function initials(name: string) {
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()
}

export default function TestimonialStrip() {
  return (
    <section className="py-16">
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <SectionHeading
          eyebrow="Real journeys"
          title="Told by the community, not by us"
          align="center"
        />
        <div className="mt-10 flex snap-x gap-5 overflow-x-auto pb-4 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {TESTIMONIALS.map((t) => (
            <GlowCard
              key={t.handle}
              className="w-[280px] shrink-0 snap-start sm:w-[320px]"
            >
              <div className="flex items-center gap-3">
                <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-gradient-to-br from-sky-400 via-fuchsia-400 to-lavender-400 text-sm font-bold text-ink-950">
                  {initials(t.name)}
                </div>
                <div>
                  <p className="text-sm font-semibold text-white">{t.name}</p>
                  <p className="text-xs text-white/50">{t.handle}</p>
                </div>
              </div>
              <p className="mt-4 text-sm leading-relaxed text-white/75">“{t.quote}”</p>
              <p className="mt-4 inline-block rounded-full bg-fuchsia-400/10 px-3 py-1 text-xs font-semibold text-fuchsia-200">
                {t.highlight}
              </p>
            </GlowCard>
          ))}
        </div>
      </div>
    </section>
  )
}
