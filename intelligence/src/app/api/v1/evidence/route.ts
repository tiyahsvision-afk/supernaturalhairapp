import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/db'
import { route, json, pageParams, paginate, allowedSourceIds } from '@/lib/api/http'

export const GET = route('evidence:read', async (ctx) => {
  const { limit, cursor, url } = pageParams(ctx.req)
  const q = url.searchParams.get('q')?.trim()
  const allowed = [...(await allowedSourceIds(ctx))]
  const where: Prisma.EvidenceWhereInput = {
    sourceId: { in: allowed },
    ...(q ? { OR: [{ title: { contains: q, mode: 'insensitive' } }, { pmid: q }, { doi: { equals: q, mode: 'insensitive' } }] } : {}),
  }
  const rows = await prisma.evidence.findMany({
    where, orderBy: { id: 'asc' }, take: limit + 1, ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    select: { id: true, title: true, pmid: true, doi: true, journal: true, publicationDate: true, studyType: true, evidenceLevel: true, qualityPreliminaryCategory: true, qualityReviewerCategory: true, texturedHairRelevant: true, sourceUrl: true, entryMode: true, reviewStatus: true, _count: { select: { links: true } } },
  })
  return json({ ...paginate(rows, limit), note: 'Unreviewed study types, levels and quality categories are preliminary.' })
})
