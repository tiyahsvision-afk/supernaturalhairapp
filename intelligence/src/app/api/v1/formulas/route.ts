import { prisma } from '@/lib/db'
import { visibilityWhere } from '@/lib/permissions'
import { route, json, pageParams, paginate } from '@/lib/api/http'

export const GET = route('formula:read', async (ctx) => {
  const { limit, cursor } = pageParams(ctx.req)
  const rows = await prisma.formula.findMany({
    where: visibilityWhere(ctx.principal),
    select: { id: true, code: true, name: true, visibility: true, isSample: true, productCategory: true, updatedAt: true, versions: { orderBy: { versionNumber: 'desc' }, take: 1, select: { id: true, versionNumber: true, status: true, chemistReviewStatus: true } } },
    orderBy: { id: 'asc' }, take: limit + 1, ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
  })
  const page = paginate(rows, limit)
  return json({ ...page, data: page.data.map(({ versions, ...f }) => ({ ...f, latestVersion: versions[0] ?? null })) })
})
