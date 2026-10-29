import { describe, expect, it } from 'vitest'
import { prisma } from '@/lib/db'
import { decide, requestReview } from '@/lib/services/review'
import { makeUser } from './fixtures'

async function anEdge() {
  return prisma.graphEdge.findFirstOrThrow({ where: { reviewStatus: { not: 'APPROVED' }, edgeType: 'CONTAINS' }, orderBy: { createdAt: 'desc' } })
}

describe('review workflow', () => {
  it('uses the configured requirement, enforces eligible roles and applies the outcome to the record', async () => {
    const submitter = await makeUser(['DATA_ANNOTATOR'])
    const edge = await anEdge()
    await prisma.reviewTask.updateMany({ where: { entityType: 'GraphEdge', entityId: edge.id }, data: { status: 'SUPERSEDED' } })
    const task = await requestReview(submitter.principal, { entityType: 'GraphEdge', entityId: edge.id, title: 'edge review' })
    expect(task.requiredRoles.sort()).toEqual(['COSMETIC_CHEMIST', 'RESEARCH_SCIENTIST'])
    const wrongRole = await makeUser(['PATENT_REVIEWER'])
    await expect(decide(wrongRole.principal, task.id, 'APPROVED', '')).rejects.toThrow(/Requires one of/)
    const reviewer = await makeUser(['RESEARCH_SCIENTIST'])
    await expect(decide(reviewer.principal, task.id, 'REJECTED', '')).rejects.toThrow(/reason is required/)
    const done = await decide(reviewer.principal, task.id, 'APPROVED', 'label confirms presence')
    expect(done.status).toBe('APPROVED')
    const after = await prisma.graphEdge.findUniqueOrThrow({ where: { id: edge.id } })
    expect(after.reviewStatus).toBe('APPROVED')
    await expect(decide(reviewer.principal, task.id, 'APPROVED', 'again')).rejects.toThrow(/closed/)
    expect(await prisma.auditLog.count({ where: { entityType: 'ReviewTask', entityId: task.id, action: 'review.decide' } })).toBe(1)
  })

  it('second-reviewer requirements need two distinct people; disagreement escalates to adjudication', async () => {
    const submitter = await makeUser(['DATA_ANNOTATOR'])
    const sr = await prisma.safetyReview.findFirstOrThrow()
    await prisma.reviewTask.updateMany({ where: { entityType: 'SafetyReview', entityId: sr.id }, data: { status: 'SUPERSEDED' } })
    const task = await requestReview(submitter.principal, { entityType: 'SafetyReview', entityId: sr.id, title: 'safety' })
    expect(task.approvalsRequired).toBe(2)
    const a = await makeUser(['DERMATOLOGIST_REVIEWER'])
    const b = await makeUser(['REGULATORY_REVIEWER'])
    const c = await makeUser(['COSMETIC_CHEMIST'])
    expect((await decide(a.principal, task.id, 'APPROVED', 'ok')).status).toBe('SECOND_REVIEW_REQUIRED')
    await expect(decide(a.principal, task.id, 'APPROVED', 'ok again')).rejects.toThrow(/already recorded/)
    expect((await decide(b.principal, task.id, 'REJECTED', 'concentration exceeds SCCS opinion')).status).toBe('SECOND_REVIEW_REQUIRED')
    expect((await decide(c.principal, task.id, 'REJECTED', 'agree with reviewer B')).status).toBe('REJECTED')
  })

  it('the audit log is append-only at the database level', async () => {
    const row = await prisma.auditLog.findFirstOrThrow()
    await expect(prisma.auditLog.update({ where: { id: row.id }, data: { action: 'tampered' } })).rejects.toThrow(/append-only/)
    await expect(prisma.auditLog.delete({ where: { id: row.id } })).rejects.toThrow(/append-only/)
  })
})
