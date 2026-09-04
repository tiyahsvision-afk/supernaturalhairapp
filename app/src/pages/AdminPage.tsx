import { useEffect, useState } from 'react'
import PageShell from '@/components/layout/PageShell'
import SectionHeading from '@/components/layout/SectionHeading'
import GlowCard from '@/components/layout/GlowCard'
import OwnerGate from '@/components/owner/OwnerGate'
import { formatFriendlyDate } from '@/lib/date'
import { ownerSignOut, subscribeToUsers } from '@/lib/chatBackend'
import type { AdminUserRecord } from '@/lib/types'

function Dashboard() {
  const [users, setUsers] = useState<AdminUserRecord[]>([])
  const [selected, setSelected] = useState<string | null>(null)

  useEffect(() => subscribeToUsers(setUsers), [])

  const active = users.find((u) => u.uid === selected)
  const totalPoints = users.reduce((sum, u) => sum + u.pointsBalance, 0)
  const totalConsultations = users.reduce((sum, u) => sum + u.consultationCount, 0)

  return (
    <PageShell>
      <div className="flex items-center justify-between">
        <SectionHeading eyebrow="Private" title="Users" />
        <button onClick={() => ownerSignOut()} className="text-sm text-ink-900/50 hover:text-ink-900">
          Sign out
        </button>
      </div>

      <div className="mt-8 grid gap-4 sm:grid-cols-3">
        {[
          { label: 'Users', value: users.length },
          { label: 'Consultations completed', value: totalConsultations },
          { label: 'Points earned (all users)', value: totalPoints },
        ].map((stat) => (
          <GlowCard key={stat.label} className="text-center !p-4">
            <p className="font-display text-2xl font-bold text-gradient">{stat.value}</p>
            <p className="text-xs text-ink-900/50">{stat.label}</p>
          </GlowCard>
        ))}
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-[320px,1fr]">
        <div className="space-y-2">
          {users.length === 0 && (
            <GlowCard className="!p-4 text-sm text-ink-900/50">No one has started their journey yet.</GlowCard>
          )}
          {users.map((u) => (
            <button
              key={u.uid}
              onClick={() => setSelected(u.uid)}
              className={`block w-full rounded-2xl border px-4 py-3 text-left transition-colors ${
                selected === u.uid
                  ? 'border-fuchsia-300 bg-fuchsia-400/10'
                  : 'border-ink-900/10 bg-white hover:bg-ink-900/[0.03]'
              }`}
            >
              <p className="text-sm font-semibold text-ink-900">{u.name || 'Unnamed'}</p>
              <p className="truncate text-xs text-ink-900/50">{u.email}</p>
              <p className="mt-1 text-xs text-ink-900/40">
                Last active {formatFriendlyDate(new Date(u.updatedAt).toISOString().slice(0, 10))}
              </p>
            </button>
          ))}
        </div>

        <GlowCard className="min-h-[24rem]">
          {!active ? (
            <p className="mt-24 text-center text-sm text-ink-900/40">Pick a user to see their details</p>
          ) : (
            <div className="space-y-5">
              <div>
                <p className="font-display text-lg font-bold text-ink-900">{active.name || 'Unnamed'}</p>
                <p className="text-sm text-ink-900/50">{active.email}</p>
              </div>

              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {[
                  { label: 'Points', value: active.pointsBalance },
                  { label: 'Consultations', value: active.consultationCount },
                  { label: 'Schedule items', value: active.scheduleItemCount },
                  { label: 'Progress photos', value: active.photoCount },
                ].map((stat) => (
                  <div key={stat.label} className="rounded-xl bg-ink-900/5 p-3 text-center">
                    <p className="font-display text-lg font-bold text-ink-900">{stat.value}</p>
                    <p className="text-[11px] text-ink-900/50">{stat.label}</p>
                  </div>
                ))}
              </div>

              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-ink-900/40">Hair goal</p>
                <p className="mt-1 text-sm text-ink-900/75">{active.hairGoal || '—'}</p>
              </div>

              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-ink-900/40">
                  Latest consultation summary
                </p>
                <p className="mt-1 text-sm leading-relaxed text-ink-900/75">
                  {active.latestConsultationSummary || 'No consultation completed yet.'}
                </p>
              </div>

              <p className="text-xs text-ink-900/40">
                Member since {formatFriendlyDate(active.memberSince.slice(0, 10))}
              </p>
            </div>
          )}
        </GlowCard>
      </div>
    </PageShell>
  )
}

export default function AdminPage() {
  return (
    <OwnerGate>
      <Dashboard />
    </OwnerGate>
  )
}
