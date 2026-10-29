import { prisma } from '@/lib/db'
import { visibilityWhere } from '@/lib/permissions'
import { route, json, pageParams, paginate } from '@/lib/api/http'

export const GET = route('rawmaterial:read', async (ctx) => {
  const { limit, cursor } = pageParams(ctx.req)
  const rows = await prisma.rawMaterial.findMany({
    where: visibilityWhere(ctx.principal),
    include: { supplier: { select: { name: true } }, components: { select: { ingredientId: true, declaredName: true, percentMin: true, percentMax: true, role: true, confirmed: true } }, _count: { select: { documents: true } } },
    orderBy: { id: 'asc' }, take: limit + 1, ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
  })
  const page = paginate(rows, limit)
  return json({
    ...page,
    data: page.data.map((r) => ({
      id: r.id, tradeName: r.tradeName, supplier: r.supplier?.name ?? null, manufacturer: r.manufacturer, declaredComposition: r.declaredComposition,
      activePercent: r.activePercent?.toString() ?? null, activePercentConfirmed: r.activePercentConfirmed, isSample: r.isSample, visibility: r.visibility,
      internalApprovalStatus: r.internalApprovalStatus, documentCount: r._count.documents,
      components: r.components.map((c) => ({ ...c, percentMin: c.percentMin?.toString() ?? null, percentMax: c.percentMax?.toString() ?? null })),
    })),
  })
})
