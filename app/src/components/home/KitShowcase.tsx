import { CORE_STEP_PRODUCTS } from '@/lib/shopify'

export default function KitShowcase() {
  return (
    <section className="pb-6 pt-2">
      <div className="mx-auto max-w-5xl px-4 sm:px-6">
        <p className="mb-5 text-center text-xs font-semibold uppercase tracking-[0.25em] text-ink-900/40">
          Your five-step Journey Kit
        </p>
        <div className="grid grid-cols-3 gap-4 sm:grid-cols-5">
          {CORE_STEP_PRODUCTS.map((p) => (
            <div key={p.id} className="text-center">
              <img
                src={p.image}
                alt={p.title}
                className="mx-auto h-20 w-20 rounded-2xl object-cover shadow-sm sm:h-24 sm:w-24"
                loading="lazy"
              />
              <p className="mt-2 text-xs font-semibold text-ink-900/70">{p.shortName}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
