import { useState } from 'react'
import PageShell from '@/components/layout/PageShell'
import SectionHeading from '@/components/layout/SectionHeading'
import GlowCard from '@/components/layout/GlowCard'
import ProductCard from '@/components/reorder/ProductCard'
import { PRODUCTS, getProduct, reorderKitUrl, reorderManyUrl } from '@/lib/shopify'
import { useAppStore } from '@/store/useAppStore'

export default function ReorderPage() {
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const kit = getProduct('journey-kit')!
  const latestConsultation = useAppStore((s) => s.consultations[0])

  function toggleSelect(id: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const recommendedIds = latestConsultation?.plan.map((p) => p.productId) ?? []

  return (
    <PageShell>
      <SectionHeading
        eyebrow="Reorder"
        title="Never run out mid-routine"
        description="One tap sends you straight to a pre-filled checkout on shcbeauty.com — no digging through the shop."
      />

      <GlowCard className="mt-10 flex flex-col items-center gap-6 bg-gradient-to-br from-sky-500/10 via-transparent to-fuchsia-500/10 p-8 text-center sm:flex-row sm:text-left">
        <img src={kit.image} alt={kit.title} className="h-28 w-28 shrink-0 rounded-2xl object-cover" />
        <div className="flex-1">
          <h3 className="font-display text-xl font-bold text-white">{kit.title}</h3>
          <p className="mt-1 text-sm text-white/60">{kit.description}</p>
          <p className="mt-2 text-lg font-semibold text-lavender-200">${kit.price.toFixed(2)}</p>
        </div>
        <a
          href={reorderKitUrl()}
          target="_blank"
          rel="noreferrer"
          className="shrink-0 rounded-full bg-gradient-to-r from-sky-400 via-fuchsia-400 to-lavender-400 px-6 py-3 text-sm font-semibold text-ink-950 hover:scale-105 transition-transform"
        >
          Reorder Full Kit
        </a>
      </GlowCard>

      {recommendedIds.length > 0 && (
        <div className="mt-6">
          <a
            href={reorderManyUrl(recommendedIds)}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-2 rounded-full border border-lavender-300/40 bg-lavender-400/10 px-4 py-2 text-sm font-semibold text-lavender-200 hover:bg-lavender-400/20"
          >
            ✦ Reorder my consultation-recommended products
          </a>
        </div>
      )}

      <div className="mt-10 flex items-center justify-between">
        <h3 className="font-display text-lg font-bold text-white">Or pick individual products</h3>
        {selected.size > 0 && (
          <a
            href={reorderManyUrl(Array.from(selected))}
            target="_blank"
            rel="noreferrer"
            className="rounded-full bg-gradient-to-r from-sky-400 to-fuchsia-400 px-4 py-2 text-sm font-semibold text-ink-950"
          >
            Reorder {selected.size} selected →
          </a>
        )}
      </div>

      <div className="mt-5 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {PRODUCTS.filter((p) => p.id !== 'journey-kit').map((product) => (
          <ProductCard
            key={product.id}
            product={product}
            selected={selected.has(product.id)}
            onToggleSelect={toggleSelect}
          />
        ))}
      </div>
    </PageShell>
  )
}
