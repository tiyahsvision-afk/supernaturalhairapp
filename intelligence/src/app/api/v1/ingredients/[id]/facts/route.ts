import { z } from 'zod'
import { EntryMode, PropertyType } from '@prisma/client'
import { prisma } from '@/lib/db'
import { route, json, ApiError, allowedSourceIds, withhold } from '@/lib/api/http'
import { createFact, detectConflicts } from '@/lib/services/facts'

export const GET = route('ingredient:read', async (ctx, { id }) => {
  const rows = await prisma.ingredientFact.findMany({ where: { ingredientId: id }, orderBy: [{ propertyType: 'asc' }, { createdAt: 'desc' }] })
  const { kept, withheld } = withhold(rows, await allowedSourceIds(ctx))
  const conflicts = detectConflicts(kept).filter((g) => g.conflict).map((g) => ({ propertyType: g.propertyType, factIds: g.facts.map((f) => f.id) }))
  const sources = new Map((await prisma.source.findMany({ where: { id: { in: kept.flatMap((f) => (f.sourceId ? [f.sourceId] : [])) } }, select: { id: true, key: true } })).map((x) => [x.id, x.key]))
  return json({
    data: kept.map((f) => ({
      id: f.id, propertyType: f.propertyType, value: f.originalValue ?? f.valueText, unit: f.originalUnit, normalizedValue: f.normalizedValue, normalizedUnit: f.normalizedUnit,
      testConditions: f.testConditions, medium: f.medium, temperatureC: f.temperatureC, source: f.sourceId ? sources.get(f.sourceId) ?? null : null, sourceLocation: f.sourceLocation, entryMode: f.entryMode,
      confidence: f.confidence, reviewStatus: f.reviewStatus, current: !f.supersededAt, retrievedAt: f.createdAt,
    })),
    conflicts,
    withheld,
    ...(withheld ? { withheldReason: 'Some facts come from sources whose terms do not permit this use.' } : {}),
  })
})

const FactSchema = z.object({
  propertyType: z.nativeEnum(PropertyType),
  value: z.string().min(1).max(500),
  unit: z.string().max(40).nullish(),
  sourceKey: z.string(),
  sourceLocation: z.string().max(500).optional(),
  entryMode: z.nativeEnum(EntryMode).default('MANUAL'),
  testConditions: z.string().max(500).optional(),
  temperatureC: z.number().optional(),
  medium: z.string().max(200).optional(),
  quotedText: z.string().max(1000).optional(),
})

export const POST = route('fact:write', async (ctx, { id }) => {
  const body = FactSchema.parse(await ctx.req.json())
  const [ing, src] = await Promise.all([prisma.ingredient.findUnique({ where: { id } }), prisma.source.findUnique({ where: { key: body.sourceKey } })])
  if (!ing) throw new ApiError(404, 'NOT_FOUND', 'Ingredient not found.')
  if (!src) throw new ApiError(422, 'UNKNOWN_SOURCE', `Unknown sourceKey: ${body.sourceKey}`)
  // Machine clients cannot claim manual (human) entry.
  const entryMode = ctx.principal.kind === 'API_KEY' && body.entryMode === 'MANUAL' ? 'IMPORTED' : body.entryMode
  const fact = await createFact(ctx.principal, { ingredientId: id, ...body, unit: body.unit ?? null, entryMode, sourceId: src.id })
  return json({ data: { id: fact.id, reviewStatus: fact.reviewStatus, normalizedValue: fact.normalizedValue, normalizedUnit: fact.normalizedUnit } }, 201)
})
