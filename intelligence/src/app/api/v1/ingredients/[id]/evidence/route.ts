import { prisma } from '@/lib/db'
import { route, json, allowedSourceIds, withhold } from '@/lib/api/http'

export const GET = route('evidence:read', async (ctx, { id }) => {
  const links = await prisma.evidenceLink.findMany({ where: { ingredientId: id }, include: { evidence: true, ontologyTerm: { select: { code: true, label: true } } } })
  const { kept, withheld } = withhold(links.map((l) => ({ ...l, sourceId: l.evidence.sourceId })), await allowedSourceIds(ctx))
  return json({
    data: kept.map((l) => ({
      evidenceId: l.evidenceId, title: l.evidence.title, pmid: l.evidence.pmid, doi: l.evidence.doi, url: l.evidence.sourceUrl, studyType: l.evidence.studyType,
      evidenceLevel: l.evidence.evidenceLevel, quality: l.evidence.qualityReviewerCategory !== 'NOT_YET_ASSESSED' ? l.evidence.qualityReviewerCategory : l.evidence.qualityPreliminaryCategory,
      qualityIsPreliminary: l.evidence.qualityReviewerCategory === 'NOT_YET_ASSESSED', role: l.role, direction: l.direction, phenotype: l.ontologyTerm, reviewStatus: l.reviewStatus,
      entryMode: l.entryMode,
    })),
    withheld,
    note: 'Evidence level and study type marked AI_EXTRACTED are proposals pending qualified review. Association does not establish causation.',
  })
})
