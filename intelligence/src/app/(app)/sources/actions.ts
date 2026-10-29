'use server'
import { revalidatePath } from 'next/cache'
import type { RightsStatus } from '@prisma/client'
import { prisma } from '@/lib/db'
import { requirePermission } from '@/lib/auth/next'
import { audit } from '@/lib/audit'
import { requestReview } from '@/lib/services/review'

/** Edits data-rights fields. Any change re-opens the rights review; permissive flags require an approved review to take effect in exports/APIs. */
export async function updateSourceRightsAction(f: FormData) {
  const s = await requirePermission('source:manage', 'source rights')
  const id = String(f.get('id'))
  const before = await prisma.source.findUniqueOrThrow({ where: { id } })
  const bool = (k: string) => f.get(k) === 'on'
  const data = {
    rightsStatus: String(f.get('rightsStatus')) as RightsStatus, license: String(f.get('license') ?? '') || null, termsUrl: String(f.get('termsUrl') ?? '') || null,
    commercialUse: String(f.get('commercialUse') ?? '') || null, redistribution: String(f.get('redistribution') ?? '') || null, attributionRequirements: String(f.get('attributionRequirements') ?? '') || null,
    storagePermission: bool('storagePermission'), cachingPermission: bool('cachingPermission'), fullTextStoragePermission: bool('fullTextStoragePermission'), documentSharingPermission: bool('documentSharingPermission'),
    allowExport: bool('allowExport'), allowExternalApi: bool('allowExternalApi'), allowModelTraining: bool('allowModelTraining'), allowPartnerSharing: bool('allowPartnerSharing'),
    reviewNotes: String(f.get('reviewNotes') ?? '') || null, reReviewDueAt: f.get('reReviewDueAt') ? new Date(String(f.get('reReviewDueAt'))) : null, termsReviewStatus: 'RE_REVIEW_REQUIRED' as const,
  }
  await prisma.source.update({ where: { id }, data })
  await audit(s.principal, { action: 'source.rights.update', entityType: 'Source', entityId: id, before, after: data, reason: String(f.get('reason') || 'Rights update') })
  await requestReview(s.principal, { entityType: 'Source', entityId: id, recordType: 'Source', title: `Data-rights re-review: ${before.name}` })
  revalidatePath(`/sources/${id}`)
}
