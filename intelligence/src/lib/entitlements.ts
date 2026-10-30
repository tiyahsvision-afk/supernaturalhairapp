// Subscription-ready entitlements and usage metering. No billing happens here: plans only set monthly limits, usage is
// recorded per organization, and payment integration can later set Organization.entitlements.plan.
import { prisma } from './db'
import type { Principal } from './permissions'

export type UsageKind = 'research.run' | 'report.generate' | 'ai.call' | 'compare' | 'wizard'

export interface Plan { key: string; label: string; limits: Partial<Record<UsageKind, number | null>>; note: string }

export const PLANS: Record<string, Plan> = {
  internal: { key: 'internal', label: 'Internal (Supernatural)', limits: {}, note: 'No limits.' },
  trial: { key: 'trial', label: 'Trial', limits: { 'research.run': 30, 'report.generate': 10, 'ai.call': 20, compare: 60, wizard: 10 }, note: 'Evaluation limits per calendar month.' },
  professional: { key: 'professional', label: 'Professional', limits: { 'research.run': 600, 'report.generate': 200, 'ai.call': 500, compare: null, wizard: null }, note: 'For independent chemists and founders.' },
  team: { key: 'team', label: 'Team', limits: { 'research.run': 3000, 'report.generate': 1000, 'ai.call': 3000, compare: null, wizard: null }, note: 'Brands and manufacturers with team workspaces.' },
}

export class EntitlementError extends Error {}

export function planFor(org: { type: string; entitlements: unknown }): Plan {
  const key = (org.entitlements as { plan?: string } | null)?.plan
  if (key && PLANS[key]) return PLANS[key]
  return org.type === 'INTERNAL' ? PLANS.internal : PLANS.trial
}

const monthStart = (d = new Date()) => new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1))

export async function usageThisMonth(organizationId: string) {
  const rows = await prisma.usageEvent.groupBy({ by: ['kind'], where: { organizationId, at: { gte: monthStart() } }, _count: true })
  return Object.fromEntries(rows.map((r) => [r.kind, r._count])) as Partial<Record<UsageKind, number>>
}

/** Throws EntitlementError when the organization's plan limit for this kind is reached; otherwise records usage. */
export async function meter(principal: Principal, kind: UsageKind, meta: Record<string, unknown> = {}) {
  const org = await prisma.organization.findUniqueOrThrow({ where: { id: principal.organizationId } })
  const plan = planFor(org)
  const limit = plan.limits[kind]
  if (limit != null) {
    const used = await prisma.usageEvent.count({ where: { organizationId: org.id, kind, at: { gte: monthStart() } } })
    if (used >= limit) throw new EntitlementError(`Your ${plan.label} plan allows ${limit} ${kind.replace('.', ' ')} per month; this month's limit is reached.`)
  }
  await prisma.usageEvent.create({ data: { organizationId: org.id, userId: principal.kind === 'USER' ? principal.id : null, kind, meta: meta as object } })
}
