import { route, json, ApiError } from '@/lib/api/http'
import { getFormulaForPrincipal, summarizeVersion } from '@/lib/services/formulas'

export const GET = route('formula:read', async (ctx, { id }) => {
  // Returns 404 (not 403) for formulas the caller cannot see, so existence is not disclosed across organizations.
  const f = await getFormulaForPrincipal(ctx.principal, id).catch(() => null)
  if (!f) throw new ApiError(404, 'NOT_FOUND', 'Formula not found.')
  const latest = f.versions[0]
  return json({
    data: {
      id: f.id, code: f.code, name: f.name, visibility: f.visibility, isSample: f.isSample,
      versions: f.versions.map((v) => ({ id: v.id, versionNumber: v.versionNumber, status: v.status, chemistReviewStatus: v.chemistReviewStatus, locked: v.locked, createdAt: v.createdAt })),
      latestLines: latest?.lines.map((l) => ({ position: l.additionOrder, phase: l.phase, displayName: l.displayName, ingredientId: l.ingredientId, rawMaterialId: l.rawMaterialId, percent: l.percent?.toString() ?? null, isQs: l.isQs })) ?? [],
      latestSummary: latest ? await summarizeVersion(latest.id) : null,
    },
    notice: 'Draft for qualified review. Not authorized for manufacture or human use unless the version status says so after chemist and safety approval.',
  })
})
