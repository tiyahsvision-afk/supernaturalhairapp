import { Link } from 'react-router-dom'
import { todayKey } from '@/lib/date'
import { getProduct } from '@/lib/shopify'
import { useAppStore } from '@/store/useAppStore'

export default function TodayChecklist() {
  const today = todayKey()
  const allScheduleItems = useAppStore((s) => s.scheduleItems)
  const items = allScheduleItems.filter((i) => i.date === today)
  const toggleScheduleItemDone = useAppStore((s) => s.toggleScheduleItemDone)

  if (items.length === 0) {
    return (
      <div className="text-sm text-white/60">
        Nothing scheduled for today.{' '}
        <Link to="/scheduler" className="text-fuchsia-300 hover:underline">
          Plan your routine →
        </Link>
      </div>
    )
  }

  const doneCount = items.filter((i) => i.done).length

  return (
    <div>
      <div className="mb-3 flex items-center justify-between text-xs text-white/50">
        <span>Today's routine</span>
        <span>
          {doneCount}/{items.length} done
        </span>
      </div>
      <div className="space-y-2">
        {items.map((item) => {
          const product = getProduct(item.productId)
          return (
            <button
              key={item.id}
              onClick={() => toggleScheduleItemDone(item.id)}
              className="flex w-full items-center gap-3 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2.5 text-left hover:bg-white/[0.06]"
            >
              <span
                className={`grid h-5 w-5 shrink-0 place-items-center rounded-full border text-[10px] ${
                  item.done ? 'border-emerald-400 bg-emerald-400 text-ink-950' : 'border-white/30 text-transparent'
                }`}
              >
                ✓
              </span>
              <span className={`text-sm ${item.done ? 'text-white/40 line-through' : 'text-white'}`}>
                {product?.title}
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
