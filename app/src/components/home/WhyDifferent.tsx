const PILLARS = [
  {
    icon: '🕊️',
    title: 'Identity, not just hair',
    body: 'Every feature here is built around a bigger question than "what oil do I use" — it\'s about who you are becoming along the way.',
  },
  {
    icon: '🙏🏽',
    title: 'Faith and sisterhood, built in',
    body: 'Identity & faith reflections, real conversation, and a community that gets it — this app holds space for that, not just your routine.',
  },
  {
    icon: '💛',
    title: 'A real person behind it',
    body: "Supernatural Hair Care isn't a faceless brand. You're walking this with Tia and a community of women doing the same thing.",
  },
]

export default function WhyDifferent() {
  return (
    <section className="py-10">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="rounded-3xl border border-ink-900/10 bg-gradient-to-br from-lavender-50 via-white to-sky-50 p-6 sm:p-10">
          <div className="mx-auto mb-8 max-w-2xl text-center">
            <p className="text-xs font-semibold uppercase tracking-[0.25em] text-fuchsia-600">
              Since 2018 · 7 years of the Journey
            </p>
            <h2 className="mt-2 font-display text-2xl font-bold text-ink-900 sm:text-3xl">
              This was never just about the hair.
            </h2>
          </div>
          <div className="grid gap-6 sm:grid-cols-3">
            {PILLARS.map((p) => (
              <div key={p.title} className="text-center sm:text-left">
                <div className="text-3xl">{p.icon}</div>
                <h3 className="mt-3 font-display text-base font-bold text-ink-900">{p.title}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-ink-900/65">{p.body}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}
