import { route, json, ApiError, allowedSourceIds } from '@/lib/api/http'
import { ingredientDetail } from '@/lib/services/ingredients'

export const GET = route('ingredient:read', async (ctx, { id }) => {
  const detail = await ingredientDetail(id)
  if (!detail || detail.ing.status !== 'ACTIVE') throw new ApiError(404, 'NOT_FOUND', 'Ingredient not found.')
  const { ing, completeness, staleRegulatory, edgeCount } = detail
  const allowed = await allowedSourceIds(ctx)
  const ok = <T extends { sourceId: string | null }>(r: T) => !r.sourceId || allowed.has(r.sourceId)
  return json({
    data: {
      id: ing.id, slug: ing.slug, canonicalName: ing.canonicalName, inciName: ing.inciName, displayName: ing.displayName, commonName: ing.commonName, chemicalName: ing.chemicalName,
      identityType: ing.identityType, materialType: ing.materialType, originType: ing.originType, family: ing.family?.slug ?? null, priorityTier: ing.priorityTier, reviewStatus: ing.reviewStatus,
      names: ing.names.filter(ok).map((n) => ({ name: n.name, type: n.nameType, preferred: n.isPreferred })),
      aliases: ing.aliases.filter(ok).map((a) => ({ alias: a.alias, type: a.aliasType })),
      identifiers: ing.identifiers.filter(ok).map((i) => ({ type: i.type, value: i.value, verificationStatus: i.verificationStatus, representative: i.isRepresentative })),
      functions: ing.functions.map((f) => ({ code: f.function.code, label: f.function.label, reviewStatus: f.reviewStatus })),
      completeness,
      staleRegulatoryCount: staleRegulatory.length,
      graphEdgeCount: edgeCount,
    },
  })
})
