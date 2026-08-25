import { useState } from 'react'
import { Link } from 'react-router-dom'
import PageShell from '@/components/layout/PageShell'
import SectionHeading from '@/components/layout/SectionHeading'
import CalendarGrid from '@/components/scheduler/CalendarGrid'
import DayDetailPanel from '@/components/scheduler/DayDetailPanel'
import { todayKey } from '@/lib/date'
import { generateWeekFromPlan } from '@/lib/scheduleGen'
import { useAppStore } from '@/store/useAppStore'

export default function SchedulerPage() {
  const [monthDate, setMonthDate] = useState(new Date())
  const [selectedDate, setSelectedDate] = useState(todayKey())
  const latestConsultation = useAppStore((s) => s.consultations[0])
  const addScheduleItems = useAppStore((s) => s.addScheduleItems)

  function generateFromConsultation() {
    if (!latestConsultation) return
    addScheduleItems(generateWeekFromPlan(latestConsultation.plan))
  }

  return (
    <PageShell>
      <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-end">
        <SectionHeading
          eyebrow="Scheduler"
          title="Plan your routine, your way"
          description="Assign products to specific days, log the hairstyles keeping your routine on track, and check things off as you go."
        />
        {latestConsultation ? (
          <button
            onClick={generateFromConsultation}
            className="shrink-0 rounded-full border border-white/20 px-4 py-2 text-sm font-semibold text-white hover:bg-white/10"
          >
            ✦ Fill next 7 days from my consultation
          </button>
        ) : (
          <Link
            to="/consultation"
            className="shrink-0 rounded-full border border-white/20 px-4 py-2 text-sm font-semibold text-white hover:bg-white/10"
          >
            Take your consultation first →
          </Link>
        )}
      </div>

      <div className="mt-10 grid gap-6 lg:grid-cols-[1.2fr,1fr]">
        <div className="glass-panel glow-border rounded-3xl p-6">
          <CalendarGrid
            monthDate={monthDate}
            selectedDate={selectedDate}
            onSelect={setSelectedDate}
            onPrevMonth={() => setMonthDate((d) => new Date(d.getFullYear(), d.getMonth() - 1, 1))}
            onNextMonth={() => setMonthDate((d) => new Date(d.getFullYear(), d.getMonth() + 1, 1))}
          />
          <div className="mt-4 flex flex-wrap gap-4 text-xs text-white/50">
            <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-fuchsia-400" /> Scheduled</span>
            <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-emerald-400" /> Done</span>
            <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-sky-300" /> Hairstyle logged</span>
          </div>
        </div>

        <DayDetailPanel dateKey={selectedDate} />
      </div>
    </PageShell>
  )
}
