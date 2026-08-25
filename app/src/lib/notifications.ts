// Browser Notification helpers. This MVP schedules reminders client-side
// (via setTimeout) while the app tab is open, which is enough to demo the
// full "hey, it's time to use this oil" flow end-to-end. Shipping true
// background push (notifications while the app/browser is fully closed)
// needs a small backend that holds push subscriptions and a service worker
// `push` handler — see app/README.md for the drop-in plan.

export function notificationsSupported(): boolean {
  return typeof window !== 'undefined' && 'Notification' in window
}

export async function requestNotificationPermission(): Promise<NotificationPermission> {
  if (!notificationsSupported()) return 'denied'
  if (Notification.permission === 'granted') return 'granted'
  return Notification.permission === 'denied' ? 'denied' : await Notification.requestPermission()
}

export function fireLocalNotification(title: string, body: string) {
  if (!notificationsSupported() || Notification.permission !== 'granted') return
  try {
    new Notification(title, {
      body,
      icon: '/favicon.svg',
      tag: 'supernatural-journey-reminder',
    })
  } catch {
    // Some browsers (mobile Safari) throw for direct `new Notification` —
    // fail silently, the in-app reminder banner still covers the UX.
  }
}
