import { prisma } from '@/lib/db'
import { route, json, allowedSourceIds, withhold } from '@/lib/api/http'
import { isStale, REGULATORY_DISCLAIMER } from '@/lib/regulatory'

export const GET = route('ingredient:read', async (ctx, { id }) => {
  const u = new URL(ctx.req.url)
  const rows = await prisma.regulatoryRecord.findMany({
    where: { ingredientId: id, ...(u.searchParams.get('includeSuperseded') === 'true' ? {} : { supersededAt: null }), ...(u.searchParams.get('jurisdiction') ? { jurisdiction: u.searchParams.get('jurisdiction')! } : {}) },
    orderBy: [{ jurisdiction: 'asc' }, { createdAt: 'desc' }],
  })
  const { kept, withheld } = withhold(rows, await allowedSourceIds(ctx))
  return json({
    data: kept.map((r) => ({
      id: r.id, jurisdiction: r.jurisdiction, authority: r.authority, regulationRef: r.regulationRef, status: r.status,
      maxConcentration: r.maxConcentration?.toString() ?? null, maxConcentrationUnit: r.maxConcentrationUnit, productRestrictions: r.productRestrictions,
      warningRequirements: r.warningRequirements, effectiveDate: r.effectiveDate, sourceUrl: r.sourceUrl, lastCheckedAt: r.lastCheckedAt,
      stale: isStale(r), reviewStatus: r.reviewStatus, entryMode: r.entryMode, superseded: !!r.supersededAt,
    })),
    withheld,
    disclaimer: REGULATORY_DISCLAIMER,
  })
})
