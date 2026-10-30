import { describe, expect, it } from 'vitest'
import { prisma } from '@/lib/db'
import { createApiKey } from '@/lib/auth/api-keys'
import { auditScope } from '@/lib/audit'
import { EntitlementError, meter } from '@/lib/entitlements'
import { addMember, createProject, generateReport, getProject, getReport, ProjectError, projectListWhere, requestProjectReview, rerunProject } from '@/lib/research/projects'
import { decide, taskVisibilityWhere } from '@/lib/services/review'
import * as researchApi from '@/app/api/v1/research/[id]/route'
import { ingredientBySlug, makeOrg, makeUser } from './fixtures'

async function quickProject(principal: Parameters<typeof createProject>[0], visibility: 'ORGANIZATION' | 'RESTRICTED' = 'ORGANIZATION') {
  const a = await ingredientBySlug('glycerin'), b = await ingredientBySlug('panthenol')
  return createProject(principal, { title: `Confidential comparison ${Math.random()}`, objective: 'test', workflow: 'COMPARISON', inputs: { ingredientIds: [a.id, b.id] }, visibility })
}

describe('organization workspaces', () => {
  it('projects and reports are invisible across organizations — in pages, lists and the API', async () => {
    const orgA = await makeOrg('BRAND'), orgB = await makeOrg('BRAND')
    const a = await makeUser(['BRAND_PARTNER'], orgA.id)
    const b = await makeUser(['SUPER_ADMIN'], orgB.id)
    const p = await quickProject(a.principal)
    const report = await generateReport(a.principal, p.id)
    expect(await getProject(b.principal, p.id)).toBeNull()
    expect(await getReport(b.principal, report.id)).toBeNull()
    expect(await prisma.researchProject.count({ where: { AND: [projectListWhere(b.principal), { id: p.id }] } })).toBe(0)
    const key = await createApiKey({ name: 'b', organizationId: orgB.id, scopes: ['research:read'] })
    const res = await researchApi.GET(new Request(`http://localhost/api/v1/research/${p.id}`, { headers: { authorization: `Bearer ${key.key}` } }), { params: Promise.resolve({ id: p.id }) })
    expect(res.status).toBe(404)
    expect(await getProject(a.principal, p.id)).not.toBeNull()
  })

  it('restricted projects are limited to the creator and members; viewers cannot re-run', async () => {
    const org = await makeOrg('BRAND')
    const owner = await makeUser(['BRAND_PARTNER'], org.id)
    const colleague = await makeUser(['BRAND_PARTNER'], org.id)
    const p = await quickProject(owner.principal, 'RESTRICTED')
    expect(await getProject(colleague.principal, p.id)).toBeNull()
    await addMember(owner.principal, p.id, colleague.user.email, 'VIEWER')
    expect(await getProject(colleague.principal, p.id)).not.toBeNull()
    await expect(rerunProject(colleague.principal, p.id)).rejects.toBeInstanceOf(ProjectError)
    const run = await rerunProject(owner.principal, p.id)
    expect(run.id).toBeTruthy()
  })

  it('members can only be added from the same organization, with no account enumeration', async () => {
    const owner = await makeUser(['BRAND_PARTNER'], (await makeOrg('BRAND')).id)
    const stranger = await makeUser(['BRAND_PARTNER'], (await makeOrg('BRAND')).id)
    const p = await quickProject(owner.principal)
    const msg = (await addMember(owner.principal, p.id, stranger.user.email, 'EDITOR').catch((e: Error) => e.message)) as string
    const msg2 = (await addMember(owner.principal, p.id, 'nobody-at-all@test.local', 'EDITOR').catch((e: Error) => e.message)) as string
    expect(msg).toBe(msg2)
  })

  it('project review tasks are hidden from, and cannot be decided by, other organizations', async () => {
    const orgA = await makeOrg('RESEARCH')
    const author = await makeUser(['RESEARCH_SCIENTIST'], orgA.id)
    const p = await quickProject(author.principal)
    const task = await requestProjectReview(author.principal, p.id)
    const outsider = await makeUser(['RESEARCH_SCIENTIST'], (await makeOrg('RESEARCH')).id)
    expect(await prisma.reviewTask.count({ where: { AND: [await taskVisibilityWhere(outsider.principal), { id: task.id }] } })).toBe(0)
    await expect(decide(outsider.principal, task.id, 'APPROVED', 'x')).rejects.toThrow(/not found/i)
    const colleague = await makeUser(['RESEARCH_SCIENTIST'], orgA.id)
    expect(await prisma.reviewTask.count({ where: { AND: [await taskVisibilityWhere(colleague.principal), { id: task.id }] } })).toBe(1)
    expect((await decide(colleague.principal, task.id, 'APPROVED', 'checked sources')).status).toBe('APPROVED')
    expect((await prisma.researchProject.findUniqueOrThrow({ where: { id: p.id } })).reviewStatus).toBe('APPROVED')
    await rerunProject(author.principal, p.id)
    expect((await prisma.researchProject.findUniqueOrThrow({ where: { id: p.id } })).reviewStatus).toBe('RE_REVIEW_REQUIRED')
  })

  it('audit history: customers see only their own entries; the platform view redacts other organizations’ research', async () => {
    const org = await makeOrg('BRAND')
    const user = await makeUser(['BRAND_PARTNER'], org.id)
    const p = await quickProject(user.principal)
    const other = await makeUser(['SUPER_ADMIN'], (await makeOrg('BRAND')).id)
    const scopeOther = await auditScope(other.principal)
    expect(await prisma.auditLog.count({ where: { AND: [scopeOther.auditWhere, { entityId: p.id }] } })).toBe(0)
    const internal = await makeUser(['SUPER_ADMIN'])
    const scopeInternal = await auditScope(internal.principal)
    const row = await prisma.auditLog.findFirstOrThrow({ where: { AND: [scopeInternal.auditWhere, { entityId: p.id, action: 'research.project.create' }] } })
    const red = scopeInternal.redact(row)
    expect(JSON.stringify({ before: red.before, after: red.after })).not.toContain(p.title)
    expect(JSON.stringify(row.after)).toContain(p.title)
  })

  it('plan limits are enforced per organization per month', async () => {
    const org = await prisma.organization.create({ data: { name: 'Trial org', slug: `trial-${Date.now()}`, type: 'BRAND', entitlements: { plan: 'trial' } } })
    const u = await makeUser(['BRAND_PARTNER'], org.id)
    await prisma.usageEvent.createMany({ data: Array.from({ length: 10 }, () => ({ organizationId: org.id, kind: 'report.generate' })) })
    await expect(meter(u.principal, 'report.generate')).rejects.toBeInstanceOf(EntitlementError)
    await meter(u.principal, 'compare')
    expect(await prisma.usageEvent.count({ where: { organizationId: org.id, kind: 'compare' } })).toBe(1)
  })
})
