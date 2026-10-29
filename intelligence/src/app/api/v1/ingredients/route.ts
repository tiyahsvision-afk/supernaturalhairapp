import { z } from 'zod'
import { IdentityType, MaterialType } from '@prisma/client'
import { prisma } from '@/lib/db'
import { route, json, pageParams, paginate, ApiError } from '@/lib/api/http'
import { search } from '@/lib/search'
import { createIngredient, ingredientWhere, IngredientError } from '@/lib/services/ingredients'

const SELECT = { id: true, slug: true, canonicalName: true, inciName: true, displayName: true, identityType: true, materialType: true, originType: true, priorityTier: true, reviewStatus: true, updatedAt: true } as const

export const GET = route('ingredient:read', async (ctx) => {
  const { limit, cursor, url } = pageParams(ctx.req)
  const q = url.searchParams.get('q')?.trim()
  const where = ingredientWhere({ functionCode: url.searchParams.get('function') ?? undefined, regulatoryJurisdiction: url.searchParams.get('jurisdiction') ?? undefined })
  if (q) {
    // Ranked search; result order follows the search ranking, with the match explanation attached.
    const { hits } = await search(ctx.principal, q, { types: ['ingredient'], limit })
    const rows = await prisma.ingredient.findMany({ where: { AND: [where, { id: { in: hits.map((h) => h.entityId) } }] }, select: SELECT })
    const byId = new Map(rows.map((r) => [r.id, r]))
    return json({ data: hits.filter((h) => byId.has(h.entityId)).map((h) => ({ ...byId.get(h.entityId), match: { term: h.matchedTerm, kind: h.termKind, why: h.why, score: h.score } })), nextCursor: null })
  }
  const rows = await prisma.ingredient.findMany({ where, select: SELECT, orderBy: { id: 'asc' }, take: limit + 1, ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}) })
  return json(paginate(rows, limit))
})

const CreateSchema = z.object({
  canonicalName: z.string().min(2).max(300),
  inciName: z.string().max(300).nullish(),
  commonName: z.string().max(300).nullish(),
  description: z.string().max(5000).nullish(),
  identityType: z.nativeEnum(IdentityType),
  materialType: z.nativeEnum(MaterialType),
  sourceKey: z.string().default('curator-seed'),
  aliases: z.array(z.string().max(300)).max(50).default([]),
})

export const POST = route('ingredient:write', async (ctx) => {
  const body = CreateSchema.parse(await ctx.req.json())
  const src = await prisma.source.findUnique({ where: { key: body.sourceKey } })
  if (!src) throw new ApiError(422, 'UNKNOWN_SOURCE', `Unknown sourceKey: ${body.sourceKey}`)
  try {
    const ing = await createIngredient(ctx.principal, { canonicalName: body.canonicalName, inciName: body.inciName, commonName: body.commonName, description: body.description, identityType: body.identityType, materialType: body.materialType, sourceId: src.id, aliases: body.aliases.map((alias) => ({ alias })) })
    return json({ data: { id: ing.id, slug: ing.slug, reviewStatus: ing.reviewStatus, note: 'Submitted for identity review.' } }, 201)
  } catch (e) {
    if (e instanceof IngredientError) throw new ApiError(409, 'DUPLICATE_INGREDIENT', e.message, { existingId: e.existingId })
    throw e
  }
})
