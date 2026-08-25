import { useEffect, useRef } from 'react'
import { useAppStore } from '@/store/useAppStore'
import { fireLocalNotification } from '@/lib/notifications'
import { getProduct } from '@/lib/shopify'
import { todayKey } from '@/lib/date'

const CHECK_INTERVAL_MS = 15 * 60 * 1000

const TIME_LABELS: Record<string, string> = {
  morning: 'This morning',
  evening: 'Tonight',
  'wash-day': "It's wash day",
}

/**
 * Best-effort in-tab reminder engine. Fires a browser Notification once per
 * undone schedule item for today. This covers the full reminder UX while
 * the app is open; true background push (app fully closed) needs a
 * service-worker + push-subscription backend — see app/README.md.
 */
export function useReminderEngine() {
  const notificationsEnabled = useAppStore((s) => s.profile.notificationsEnabled)
  const scheduleItems = useAppStore((s) => s.scheduleItems)
  const notifiedIds = useRef<Set<string>>(new Set())

  useEffect(() => {
    if (!notificationsEnabled) return

    function check() {
      const today = todayKey()
      const due = scheduleItems.filter(
        (i) => i.date === today && !i.done && !notifiedIds.current.has(i.id),
      )
      for (const item of due) {
        const product = getProduct(item.productId)
        if (!product) continue
        fireLocalNotification(
          'Supernatural Journey — reminder',
          `${TIME_LABELS[item.timeOfDay] ?? 'Today'}: it's time to use your ${product.title}. Check it off when done!`,
        )
        notifiedIds.current.add(item.id)
      }
    }

    check()
    const interval = window.setInterval(check, CHECK_INTERVAL_MS)
    return () => window.clearInterval(interval)
  }, [notificationsEnabled, scheduleItems])
}
