import { useEffect, useRef } from 'react'
import { chatBackendConfigured } from '@/lib/chatConfig'
import { useAppStore } from '@/store/useAppStore'

/** Pushes a lean snapshot of the current visitor's profile + activity to
 * Firebase (once onboarded) so the owner's admin dashboard can see it. */
export function useUserSync() {
  const onboarded = useAppStore((s) => s.onboarded)
  const profile = useAppStore((s) => s.profile)
  const pointsBalance = useAppStore((s) => s.pointsBalance())
  const consultationCount = useAppStore((s) => s.consultations.length)
  const scheduleItemCount = useAppStore((s) => s.scheduleItems.length)
  const photoCount = useAppStore((s) => s.photos.length)
  const latestSummary = useAppStore((s) => s.consultations[0]?.summary ?? '')
  const backendRef = useRef<typeof import('@/lib/chatBackend') | null>(null)

  useEffect(() => {
    if (!onboarded || !chatBackendConfigured()) return
    let cancelled = false

    async function sync() {
      const backend = backendRef.current ?? (await import('@/lib/chatBackend'))
      backendRef.current = backend
      const uid = await backend.ensureCustomerAuth()
      if (!uid || cancelled) return
      await backend.syncUserProfile(uid, {
        name: profile.name,
        email: profile.email,
        hairGoal: profile.hairGoal,
        memberSince: profile.memberSince,
        pointsBalance,
        consultationCount,
        scheduleItemCount,
        photoCount,
        latestConsultationSummary: latestSummary,
      })
    }

    sync().catch(() => {})
    return () => {
      cancelled = true
    }
  }, [
    onboarded,
    profile.name,
    profile.email,
    profile.hairGoal,
    profile.memberSince,
    pointsBalance,
    consultationCount,
    scheduleItemCount,
    photoCount,
    latestSummary,
  ])
}
