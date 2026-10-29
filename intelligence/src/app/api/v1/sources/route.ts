import { prisma } from '@/lib/db'
import { route, json } from '@/lib/api/http'

export const GET = route('ingredient:read', async () => {
  const rows = await prisma.source.findMany({
    orderBy: { key: 'asc' },
    select: { key: true, name: true, owner: true, type: true, url: true, accessMethod: true, apiStatus: true, license: true, termsUrl: true, rightsStatus: true, commercialUse: true, redistribution: true, attributionRequirements: true, storagePermission: true, fullTextStoragePermission: true, allowExport: true, allowExternalApi: true, allowModelTraining: true, allowPartnerSharing: true, termsReviewStatus: true, lastTermsReviewAt: true, lastSuccessfulImportAt: true, recordCount: true, approvedUses: true, prohibitedUses: true },
  })
  return json({ data: rows })
})
