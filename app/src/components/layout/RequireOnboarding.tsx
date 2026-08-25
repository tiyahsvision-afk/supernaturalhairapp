import type { ReactNode } from 'react'
import { Navigate } from 'react-router-dom'
import { useAppStore } from '@/store/useAppStore'

export default function RequireOnboarding({ children }: { children: ReactNode }) {
  const onboarded = useAppStore((s) => s.onboarded)
  if (!onboarded) return <Navigate to="/onboarding" replace />
  return <>{children}</>
}
