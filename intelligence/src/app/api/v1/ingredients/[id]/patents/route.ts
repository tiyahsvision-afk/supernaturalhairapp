import { prisma } from '@/lib/db'
import { route, json, allowedSourceIds, withhold } from '@/lib/api/http'

export const GET = route('patent:read', async (ctx, { id }) => {
  const links = await prisma.patentLink.findMany({ where: { ingredientId: id }, include: { patent: true } })
  const { kept, withheld } = withhold(links.map((l) => ({ ...l, sourceId: l.patent.sourceId })), await allowedSourceIds(ctx))
  return json({
    data: kept.map((l) => ({ patentId: l.patentId, publicationNumber: l.patent.publicationNumber, title: l.patent.title, jurisdiction: l.patent.jurisdiction, officialUrl: l.patent.officialUrl, legalStatus: l.patent.legalStatus, relation: l.relation, reviewStatus: l.reviewStatus })),
    withheld,
    notice: 'Research aid — not a legal opinion. Patent status, scope and freedom to operate require review by a qualified patent professional.',
  })
})
