import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/db'
import { route, json, pageParams, paginate, allowedSourceIds } from '@/lib/api/http'

export const GET = route('patent:read', async (ctx) => {
  const { limit, cursor, url } = pageParams(ctx.req)
  const q = url.searchParams.get('q')?.trim()
  const where: Prisma.PatentWhereInput = {
    sourceId: { in: [...(await allowedSourceIds(ctx))] },
    ...(q ? { OR: [{ title: { contains: q, mode: 'insensitive' } }, { publicationNumber: { contains: q.replace(/[\s-]/g, ''), mode: 'insensitive' } }] } : {}),
  }
  const rows = await prisma.patent.findMany({
    where, orderBy: { id: 'asc' }, take: limit + 1, ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    select: { id: true, publicationNumber: true, title: true, jurisdiction: true, officialUrl: true, legalStatus: true, publicationDate: true, lastCheckedAt: true, reviewStatus: true, _count: { select: { links: true } } },
  })
  return json({ ...paginate(rows, limit), notice: 'Research aid — not a legal opinion.' })
})
