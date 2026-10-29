import { z } from 'zod'
import { ApplicationType } from '@prisma/client'
import { prisma } from '@/lib/db'
import { route, json, pageParams, paginate, ApiError } from '@/lib/api/http'
import { findDuplicateProduct, recordProductVersion, upsertProduct } from '@/lib/services/products'

export const GET = route('product:read', async (ctx) => {
  const { limit, cursor, url } = pageParams(ctx.req)
  const brand = url.searchParams.get('brand')
  const rows = await prisma.product.findMany({
    where: { ...(brand ? { brand: { equals: brand, mode: 'insensitive' } } : {}), OR: [{ ownerOrgId: null }, { ownerOrgId: ctx.principal.organizationId }] },
    include: { versions: { where: { validTo: null }, take: 1, include: { lines: { orderBy: { position: 'asc' }, select: { position: true, displayedName: true, ingredientId: true, parsingStatus: true, identityConfidence: true } } } } },
    orderBy: { id: 'asc' }, take: limit + 1, ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
  })
  const page = paginate(rows, limit)
  return json({
    ...page,
    data: page.data.map(({ versions, ...p }) => ({
      id: p.id, brand: p.brand, name: p.name, category: p.category, applicationType: p.applicationType, barcode: p.barcode, isSupernatural: p.isSupernatural, discontinued: p.discontinued,
      currentVersion: versions[0] ? { id: versions[0].id, versionNumber: versions[0].versionNumber, validFrom: versions[0].validFrom, source: versions[0].ingredientListSource, sourceUrl: versions[0].sourceUrl, lines: versions[0].lines } : null,
    })),
  })
})

const ProductSchema = z.object({
  brand: z.string().min(1).max(200),
  name: z.string().min(1).max(300),
  category: z.string().max(100).optional(),
  applicationType: z.nativeEnum(ApplicationType).default('UNKNOWN'),
  barcode: z.string().regex(/^\d{8,14}$/, 'GTIN must be 8–14 digits').nullish(),
  ingredientList: z.string().min(3).max(20_000),
  listSource: z.string().default('MANUFACTURER_WEBSITE'),
  sourceUrl: z.string().url().nullish(),
  sourceKey: z.string().default('manufacturer-labels'),
  allowDuplicate: z.boolean().default(false),
})

export const POST = route('product:write', async (ctx) => {
  const body = ProductSchema.parse(await ctx.req.json())
  if (!body.allowDuplicate) {
    const dup = await findDuplicateProduct(body)
    if (dup) throw new ApiError(409, 'POSSIBLE_DUPLICATE', `Possible duplicate (${dup.reason}). Re-send with allowDuplicate=true if this is a distinct product.`, { existingId: dup.product.id })
  }
  const src = await prisma.source.findUnique({ where: { key: body.sourceKey } })
  if (!src) throw new ApiError(422, 'UNKNOWN_SOURCE', `Unknown sourceKey: ${body.sourceKey}`)
  const { product } = await upsertProduct(ctx.principal, { brand: body.brand, name: body.name, category: body.category, applicationType: body.applicationType, barcode: body.barcode ?? null, purchaseUrl: body.sourceUrl ?? null, ownerOrgId: ctx.external ? ctx.principal.organizationId : null })
  const version = await recordProductVersion(ctx.principal, product.id, { ingredientListRaw: body.ingredientList, ingredientListSource: body.listSource, sourceUrl: body.sourceUrl ?? null, sourceId: src.id })
  return json({ data: { productId: product.id, versionId: version.version.id, outcome: version.outcome } }, 201)
})
