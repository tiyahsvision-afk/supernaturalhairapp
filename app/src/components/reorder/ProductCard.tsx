import GlowCard from '@/components/layout/GlowCard'
import type { ShcProduct } from '@/lib/shopify'
import { reorderSingleUrl } from '@/lib/shopify'

interface ProductCardProps {
  product: ShcProduct
  selected: boolean
  onToggleSelect: (id: string) => void
}

export default function ProductCard({ product, selected, onToggleSelect }: ProductCardProps) {
  return (
    <GlowCard className={`relative ${selected ? '!border-fuchsia-300' : ''}`}>
      <button
        onClick={() => onToggleSelect(product.id)}
        className={`absolute right-4 top-4 grid h-6 w-6 place-items-center rounded-full border text-xs ${
          selected ? 'border-fuchsia-300 bg-fuchsia-400 text-ink-950' : 'border-white/25 text-transparent'
        }`}
        aria-label={selected ? 'Deselect' : 'Select for reorder'}
      >
        ✓
      </button>
      <img src={product.image} alt={product.title} className="h-32 w-full rounded-xl object-cover" loading="lazy" />
      <h3 className="mt-3 font-display text-sm font-bold text-white">{product.title}</h3>
      <p className="mt-1 line-clamp-2 text-xs text-white/55">{product.description}</p>
      <div className="mt-3 flex items-center justify-between">
        <span className="text-sm font-semibold text-lavender-200">${product.price.toFixed(2)}</span>
        <a
          href={reorderSingleUrl(product.id)}
          target="_blank"
          rel="noreferrer"
          className="rounded-full border border-white/20 px-3 py-1.5 text-xs font-semibold text-white hover:bg-white/10"
        >
          Reorder →
        </a>
      </div>
    </GlowCard>
  )
}
