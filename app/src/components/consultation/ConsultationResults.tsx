import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import GlowCard from '@/components/layout/GlowCard'
import type { ConsultationResult } from '@/lib/types'
import { getProduct } from '@/lib/shopify'
import { generateWeekFromPlan } from '@/lib/scheduleGen'
import { useAppStore } from '@/store/useAppStore'

interface ConsultationResultsProps {
  result: ConsultationResult
  onRetake: () => void
}

export default function ConsultationResults({ result, onRetake }: ConsultationResultsProps) {
  const addScheduleItems = useAppStore((s) => s.addScheduleItems)
  const [added, setAdded] = useState(false)
  const navigate = useNavigate()

  function handleAddToScheduler() {
    const items = generateWeekFromPlan(result.plan)
    addScheduleItems(items)
    setAdded(true)
  }

  return (
    <div className="space-y-6">
      <GlowCard>
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-sky-600">
          Your plan · {new Date(result.createdAt).toLocaleDateString()}
        </p>
        <p className="mt-3 text-ink-900/80">{result.summary}</p>
        <div className="mt-5 flex flex-wrap gap-3">
          <button
            onClick={handleAddToScheduler}
            className="rounded-full bg-gradient-to-r from-sky-400 via-fuchsia-400 to-lavender-400 px-5 py-2.5 text-sm font-semibold text-ink-950 hover:scale-105 transition-transform"
          >
            {added ? '✓ Added to scheduler' : 'Add this week to my scheduler'}
          </button>
          {added && (
            <button
              onClick={() => navigate('/scheduler')}
              className="rounded-full border border-ink-900/20 px-5 py-2.5 text-sm font-semibold text-ink-900 hover:bg-ink-900/10"
            >
              View scheduler →
            </button>
          )}
          <button
            onClick={onRetake}
            className="rounded-full border border-ink-900/20 px-5 py-2.5 text-sm font-semibold text-ink-900/80 hover:bg-ink-900/10"
          >
            Update my consultation
          </button>
        </div>
      </GlowCard>

      <div className="grid gap-4 sm:grid-cols-2">
        {result.plan.map((item) => {
          const product = getProduct(item.productId)
          if (!product) return null
          return (
            <GlowCard key={item.productId} className="flex gap-4">
              <img
                src={product.image}
                alt={product.title}
                className="h-20 w-20 shrink-0 rounded-xl object-cover"
                loading="lazy"
              />
              <div>
                <h3 className="font-display text-sm font-bold text-ink-900">{product.title}</h3>
                <p className="mt-1 text-xs font-semibold text-fuchsia-600">{item.frequency}</p>
                <p className="mt-1 text-xs leading-relaxed text-ink-900/60">{item.guidance}</p>
              </div>
            </GlowCard>
          )
        })}
      </div>
    </div>
  )
}
