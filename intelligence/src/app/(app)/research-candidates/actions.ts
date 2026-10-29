'use server'
import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/db'
import { requirePermission } from '@/lib/auth/next'
import { audit } from '@/lib/audit'
import { reindexResearchCandidate } from '@/lib/search-index'
import { requestReview } from '@/lib/services/review'

export async function createCandidateAction(f: FormData) {
  const s = await requirePermission('ip:write', 'create research candidate')
  const rc = await prisma.$transaction(async (tx) => {
    const count = await tx.researchCandidate.count()
    let n = count + 1, code = ''
    do { code = `SN-${String(n).padStart(3, '0')}`; n++ } while (await tx.researchCandidate.findUnique({ where: { code } }))
    return tx.researchCandidate.create({ data: { code, title: String(f.get('title')).trim(), description: String(f.get('description')).trim(), candidateType: String(f.get('candidateType')), hypothesis: String(f.get('hypothesis') ?? '') || null, ownerOrgId: s.principal.organizationId, visibility: 'CONFIDENTIAL_IP', createdById: s.user.id } })
  })
  await audit(s.principal, { action: 'candidate.create', entityType: 'ResearchCandidate', entityId: rc.id, after: { code: rc.code } })
  await reindexResearchCandidate(rc.id)
  await requestReview(s.principal, { entityType: 'ResearchCandidate', entityId: rc.id, recordType: 'ResearchCandidate', title: `Scientific + IP review: ${rc.code}` })
  revalidatePath('/research-candidates')
}
