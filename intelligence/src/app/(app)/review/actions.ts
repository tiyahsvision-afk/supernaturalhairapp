'use server'
import { revalidatePath } from 'next/cache'
import type { IdentityDecision } from '@prisma/client'
import { prisma } from '@/lib/db'
import { requirePermission } from '@/lib/auth/next'
import { decide, ReviewError } from '@/lib/services/review'
import { decideCandidate, unmerge, IdentityError } from '@/lib/services/identity'
import { audit } from '@/lib/audit'

export async function decideAction(_p: { error?: string; ok?: string } | undefined, f: FormData) {
  const s = await requirePermission('review:act', 'review decision')
  try {
    const t = await decide(s.principal, String(f.get('taskId')), String(f.get('decision')) as never, String(f.get('notes') ?? ''))
    revalidatePath('/review')
    return { ok: `Recorded. Task is now ${t.status.toLowerCase().replace(/_/g, ' ')}.` }
  } catch (e) { if (e instanceof ReviewError) return { error: e.message }; throw e }
}

export async function assignToMeAction(f: FormData) {
  const s = await requirePermission('review:act', 'assign review')
  const id = String(f.get('taskId'))
  await prisma.reviewTask.update({ where: { id }, data: { assignedToId: s.user.id, status: 'ASSIGNED' } })
  await audit(s.principal, { action: 'review.assign', entityType: 'ReviewTask', entityId: id, after: { assignedToId: s.user.id } })
  revalidatePath('/review')
}

export async function resolveQuarantineAction(f: FormData) {
  const s = await requirePermission('review:act', 'quarantine resolution')
  const id = String(f.get('id')), status = String(f.get('status')) as 'RESOLVED' | 'DISMISSED', resolution = String(f.get('resolution') ?? '').trim()
  if (!resolution) throw new Error('A resolution note is required.')
  await prisma.quarantineItem.update({ where: { id }, data: { status, resolution, resolvedById: s.user.id, resolvedAt: new Date() } })
  await audit(s.principal, { action: 'quarantine.resolve', entityType: 'QuarantineItem', entityId: id, after: { status, resolution } })
  revalidatePath('/review')
}

export async function identityDecisionAction(_p: { error?: string } | undefined, f: FormData) {
  const s = await requirePermission('ingredient:approve', 'identity decision')
  try { await decideCandidate(s.principal, String(f.get('candidateId')), String(f.get('decision')) as IdentityDecision, String(f.get('notes') ?? '')) } catch (e) { if (e instanceof IdentityError) return { error: e.message }; throw e }
  revalidatePath('/review')
  return {}
}

export async function unmergeAction(f: FormData) {
  const s = await requirePermission('ingredient:merge', 'unmerge')
  await unmerge(s.principal, String(f.get('eventId')), String(f.get('reason') || 'Merge reversed'))
  revalidatePath('/review')
}
