import { useState } from 'react'
import { notificationsSupported, requestNotificationPermission } from '@/lib/notifications'
import { useAppStore } from '@/store/useAppStore'

export default function NotificationToggle() {
  const enabled = useAppStore((s) => s.profile.notificationsEnabled)
  const setNotificationsEnabled = useAppStore((s) => s.setNotificationsEnabled)
  const [error, setError] = useState('')

  async function handleToggle() {
    if (enabled) {
      setNotificationsEnabled(false)
      return
    }
    if (!notificationsSupported()) {
      setError("This browser doesn't support notifications — reminders will still show in your checklist.")
      setNotificationsEnabled(true)
      return
    }
    const permission = await requestNotificationPermission()
    if (permission === 'granted') {
      setNotificationsEnabled(true)
      setError('')
    } else {
      setError('Notifications are blocked — enable them in your browser settings, or just use the checklist below.')
    }
  }

  return (
    <div>
      <button
        onClick={handleToggle}
        className={`flex w-full items-center justify-between rounded-2xl border px-4 py-3 text-left transition-colors ${
          enabled ? 'border-fuchsia-300 bg-fuchsia-400/15' : 'border-white/15 bg-white/5 hover:border-white/30'
        }`}
      >
        <span>
          <span className="block text-sm font-semibold text-white">
            {enabled ? '🔔 Reminders are on' : '🔕 Turn on reminders'}
          </span>
          <span className="mt-0.5 block text-xs text-white/50">
            "Hey, it's time to use this oil" — right when your schedule says so.
          </span>
        </span>
        <span
          className={`h-6 w-11 shrink-0 rounded-full border transition-colors ${
            enabled ? 'border-fuchsia-300 bg-fuchsia-400' : 'border-white/20 bg-white/10'
          }`}
        >
          <span
            className={`block h-5 w-5 translate-y-[1px] rounded-full bg-white transition-transform ${
              enabled ? 'translate-x-[22px]' : 'translate-x-[1px]'
            }`}
          />
        </span>
      </button>
      {error && <p className="mt-2 text-xs text-fuchsia-200">{error}</p>}
    </div>
  )
}
