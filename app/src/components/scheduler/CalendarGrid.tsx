import { addDays, formatMonthLabel, isSameMonth, startOfCalendarGrid, toDateKey, WEEKDAY_LABELS } from '@/lib/date'
import { useAppStore } from '@/store/useAppStore'

interface CalendarGridProps {
  monthDate: Date
  selectedDate: string
  onSelect: (dateKey: string) => void
  onPrevMonth: () => void
  onNextMonth: () => void
}

export default function CalendarGrid({
  monthDate,
  selectedDate,
  onSelect,
  onPrevMonth,
  onNextMonth,
}: CalendarGridProps) {
  const scheduleItems = useAppStore((s) => s.scheduleItems)
  const hairstyles = useAppStore((s) => s.hairstyles)

  const gridStart = startOfCalendarGrid(monthDate)
  const days = Array.from({ length: 42 }, (_, i) => addDays(gridStart, i))
  const todayKeyValue = toDateKey(new Date())

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h3 className="font-display text-lg font-bold text-ink-900">{formatMonthLabel(monthDate)}</h3>
        <div className="flex gap-2">
          <button
            onClick={onPrevMonth}
            className="grid h-8 w-8 place-items-center rounded-full border border-ink-900/15 text-ink-900/70 hover:bg-ink-900/10"
            aria-label="Previous month"
          >
            ←
          </button>
          <button
            onClick={onNextMonth}
            className="grid h-8 w-8 place-items-center rounded-full border border-ink-900/15 text-ink-900/70 hover:bg-ink-900/10"
            aria-label="Next month"
          >
            →
          </button>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-1.5 text-center text-xs font-semibold text-ink-900/40">
        {WEEKDAY_LABELS.map((d) => (
          <div key={d} className="py-1">
            {d}
          </div>
        ))}
      </div>

      <div className="mt-1 grid grid-cols-7 gap-1.5">
        {days.map((day) => {
          const key = toDateKey(day)
          const inMonth = isSameMonth(day, monthDate)
          const dayItems = scheduleItems.filter((i) => i.date === key)
          const hairstyle = hairstyles.find((h) => h.date === key)
          const isSelected = key === selectedDate
          const isToday = key === todayKeyValue

          return (
            <button
              key={key}
              onClick={() => onSelect(key)}
              className={`flex h-16 flex-col items-center justify-start rounded-xl border p-1.5 text-xs transition-colors sm:h-20 ${
                isSelected
                  ? 'border-fuchsia-300 bg-fuchsia-400/15'
                  : isToday
                    ? 'border-sky-300/60 bg-sky-400/10'
                    : 'border-ink-900/10 bg-ink-900/[0.03] hover:bg-ink-900/[0.07]'
              } ${inMonth ? '' : 'opacity-30'}`}
            >
              <span className={`font-semibold ${isToday ? 'text-sky-600' : 'text-ink-900/80'}`}>
                {day.getDate()}
              </span>
              <div className="mt-1 flex flex-wrap items-center justify-center gap-0.5">
                {dayItems.slice(0, 4).map((item) => (
                  <span
                    key={item.id}
                    className={`h-1.5 w-1.5 rounded-full ${item.done ? 'bg-emerald-400' : 'bg-fuchsia-400'}`}
                  />
                ))}
                {hairstyle && <span className="h-1.5 w-1.5 rounded-full bg-sky-300" />}
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}
