import { useState } from 'react'
import GlowCard from '@/components/layout/GlowCard'
import { formatFriendlyDate } from '@/lib/date'
import { PRODUCTS, getProduct } from '@/lib/shopify'
import { useAppStore } from '@/store/useAppStore'
import type { ScheduleItem } from '@/lib/types'
import { newId } from '@/lib/id'

const TIME_LABELS: Record<ScheduleItem['timeOfDay'], string> = {
  morning: 'Morning',
  evening: 'Evening',
  'wash-day': 'Wash day',
}

export default function DayDetailPanel({ dateKey }: { dateKey: string }) {
  const allScheduleItems = useAppStore((s) => s.scheduleItems)
  const allHairstyles = useAppStore((s) => s.hairstyles)
  const scheduleItems = allScheduleItems.filter((i) => i.date === dateKey)
  const hairstyle = allHairstyles.find((h) => h.date === dateKey)
  const addScheduleItems = useAppStore((s) => s.addScheduleItems)
  const removeScheduleItem = useAppStore((s) => s.removeScheduleItem)
  const toggleScheduleItemDone = useAppStore((s) => s.toggleScheduleItemDone)
  const addHairstyle = useAppStore((s) => s.addHairstyle)
  const removeHairstyle = useAppStore((s) => s.removeHairstyle)

  const [productId, setProductId] = useState(PRODUCTS[0].id)
  const [timeOfDay, setTimeOfDay] = useState<ScheduleItem['timeOfDay']>('evening')
  const [hairstyleName, setHairstyleName] = useState('')
  const [hairstyleNotes, setHairstyleNotes] = useState('')

  function handleAddItem() {
    addScheduleItems([{ id: newId(), date: dateKey, productId, timeOfDay, done: false }])
  }

  function handleAddHairstyle() {
    if (!hairstyleName.trim()) return
    addHairstyle({ date: dateKey, name: hairstyleName.trim(), notes: hairstyleNotes.trim() })
    setHairstyleName('')
    setHairstyleNotes('')
  }

  return (
    <GlowCard className="space-y-6">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-sky-300">
          {formatFriendlyDate(dateKey)}
        </p>
        <h3 className="mt-1 font-display text-lg font-bold text-white">Routine for this day</h3>
      </div>

      <div className="space-y-2">
        {scheduleItems.length === 0 && (
          <p className="text-sm text-white/50">Nothing scheduled yet — add a product below.</p>
        )}
        {scheduleItems.map((item) => {
          const product = getProduct(item.productId)
          return (
            <div
              key={item.id}
              className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2.5"
            >
              <button onClick={() => toggleScheduleItemDone(item.id)} className="flex flex-1 items-center gap-3 text-left">
                <span
                  className={`grid h-5 w-5 shrink-0 place-items-center rounded-full border text-[10px] ${
                    item.done ? 'border-emerald-400 bg-emerald-400 text-ink-950' : 'border-white/30 text-transparent'
                  }`}
                >
                  ✓
                </span>
                <span>
                  <span className={`text-sm font-medium ${item.done ? 'text-white/40 line-through' : 'text-white'}`}>
                    {product?.title}
                  </span>
                  <span className="ml-2 text-xs text-white/40">{TIME_LABELS[item.timeOfDay]}</span>
                </span>
              </button>
              <button
                onClick={() => removeScheduleItem(item.id)}
                className="text-xs text-white/30 hover:text-fuchsia-300"
                aria-label="Remove"
              >
                ✕
              </button>
            </div>
          )
        })}
      </div>

      <div className="flex flex-wrap items-center gap-2 border-t border-white/10 pt-4">
        <select
          value={productId}
          onChange={(e) => setProductId(e.target.value)}
          className="rounded-xl border border-white/15 bg-ink-800 px-3 py-2 text-sm text-white outline-none"
        >
          {PRODUCTS.map((p) => (
            <option key={p.id} value={p.id}>
              {p.title}
            </option>
          ))}
        </select>
        <select
          value={timeOfDay}
          onChange={(e) => setTimeOfDay(e.target.value as ScheduleItem['timeOfDay'])}
          className="rounded-xl border border-white/15 bg-ink-800 px-3 py-2 text-sm text-white outline-none"
        >
          <option value="morning">Morning</option>
          <option value="evening">Evening</option>
          <option value="wash-day">Wash day</option>
        </select>
        <button
          onClick={handleAddItem}
          className="rounded-full bg-gradient-to-r from-sky-400 to-fuchsia-400 px-4 py-2 text-sm font-semibold text-ink-950"
        >
          + Add product
        </button>
      </div>

      <div className="border-t border-white/10 pt-4">
        <p className="mb-2 text-sm font-semibold text-white/70">Hairstyle</p>
        {hairstyle ? (
          <div className="flex items-start justify-between rounded-xl border border-sky-300/20 bg-sky-400/5 px-3 py-2.5">
            <div>
              <p className="text-sm font-medium text-white">{hairstyle.name}</p>
              {hairstyle.notes && <p className="mt-0.5 text-xs text-white/50">{hairstyle.notes}</p>}
            </div>
            <button
              onClick={() => removeHairstyle(hairstyle.id)}
              className="text-xs text-white/30 hover:text-fuchsia-300"
            >
              ✕
            </button>
          </div>
        ) : (
          <div className="flex flex-wrap gap-2">
            <input
              value={hairstyleName}
              onChange={(e) => setHairstyleName(e.target.value)}
              placeholder="e.g. Braided pineapple bun"
              className="min-w-[180px] flex-1 rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-white/30 outline-none focus:border-fuchsia-300"
            />
            <input
              value={hairstyleNotes}
              onChange={(e) => setHairstyleNotes(e.target.value)}
              placeholder="Notes (optional)"
              className="min-w-[140px] flex-1 rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-white/30 outline-none focus:border-fuchsia-300"
            />
            <button
              onClick={handleAddHairstyle}
              className="rounded-full border border-white/20 px-4 py-2 text-sm font-semibold text-white hover:bg-white/10"
            >
              Save
            </button>
          </div>
        )}
      </div>
    </GlowCard>
  )
}
