'use server'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import type { Prisma, QualityCategory, StudyType } from '@prisma/client'
import { prisma } from '@/lib/db'
import { requirePermission } from '@/lib/auth/next'
import { audit } from '@/lib/audit'
import { CRITERIA, preliminaryCategory, RUBRIC_VERSION } from '@/lib/evidence-rubric'
import { reindexEvidence } from '@/lib/search-index'
import { requestReview } from '@/lib/services/review'
import { upsertEdge } from '@/lib/services/graph'

export async function createEvidenceAction(_p: { error?: string } | undefined, f: FormData) {
  const s = await requirePermission('evidence:write', 'create evidence')
  const pmid = String(f.get('pmid') ?? '').trim() || null, doi = String(f.get('doi') ?? '').trim().toLowerCase() || null
  if (!pmid && !doi && !String(f.get('url') ?? '').trim()) return { error: 'Provide a PMID, DOI or source URL — every evidence record must link to its source.' }
  const dup = await prisma.evidence.findFirst({ where: { OR: [...(pmid ? [{ pmid }] : []), ...(doi ? [{ doi }] : [])] } })
  if (dup) return { error: `Already recorded: ${dup.title}` }
  const src = await prisma.source.findUniqueOrThrow({ where: { key: 'pubmed-metadata' } })
  const level = String(f.get('level') ?? '') ? Number(f.get('level')) : null
  const ev = await prisma.evidence.create({ data: { title: String(f.get('title')).trim(), pmid, doi, studyType: String(f.get('studyType')) as StudyType, evidenceLevel: level, sourceUrl: String(f.get('url') || '') || (pmid ? `https://pubmed.ncbi.nlm.nih.gov/${pmid}/` : `https://doi.org/${doi}`), journal: String(f.get('journal') ?? '') || null, sampleSize: f.get('sampleSize') ? Number(f.get('sampleSize')) : null, population: String(f.get('population') ?? '') || null, limitations: String(f.get('limitations') ?? '') || null, sourceConclusion: String(f.get('sourceConclusion') ?? '') || null, sourceId: src.id, entryMode: 'MANUAL' } })
  for (const ref of String(f.get('ingredients') ?? '').split(/[\s,]+/).filter(Boolean)) {
    const ingredientId = ref.replace(/^ing:/, '')
    if (!(await prisma.ingredient.findUnique({ where: { id: ingredientId } }))) continue
    await prisma.evidenceLink.create({ data: { evidenceId: ev.id, ingredientId, role: 'EXPOSURE', direction: 'UNCLEAR', entryMode: 'MANUAL' } })
    await upsertEdge(s.principal, { fromType: 'Ingredient', fromId: ingredientId, toType: 'Study', toId: ev.id, edgeType: 'STUDIED_IN', sourceId: src.id, confidence: 0.8, evidenceType: 'LITERATURE_METADATA' })
  }
  await audit(s.principal, { action: 'evidence.create', entityType: 'Evidence', entityId: ev.id, after: ev })
  await reindexEvidence(ev.id)
  await requestReview(s.principal, { entityType: 'Evidence', entityId: ev.id, title: `Evidence review: ${ev.title.slice(0, 80)}` })
  redirect(`/evidence/${ev.id}`)
}

/** Records rubric scores and the reviewer's grade. The final grade is a human decision with a reason. */
export async function gradeEvidenceAction(f: FormData) {
  const s = await requirePermission('evidence:approve', 'grade evidence')
  const id = String(f.get('id'))
  const scores: Record<string, number | null> = {}
  for (const c of CRITERIA) { const v = String(f.get(`c_${c.key}`) ?? ''); scores[c.key] = v === '' ? null : Number(v) }
  const prelim = preliminaryCategory(scores)
  const final = String(f.get('final') || prelim) as QualityCategory
  const reason = String(f.get('reason') ?? '').trim()
  if (final !== prelim && !reason) throw new Error('An adjustment reason is required when the reviewer grade differs from the preliminary grade.')
  const before = await prisma.evidence.findUniqueOrThrow({ where: { id } })
  await prisma.evidence.update({ where: { id }, data: { qualityPreliminary: scores as Prisma.InputJsonValue, qualityPreliminaryCategory: prelim, qualityReviewerCategory: final, qualityAdjustmentReason: reason || null, rubricVersion: RUBRIC_VERSION, reviewedInterpretation: String(f.get('interpretation') ?? '') || before.reviewedInterpretation, reviewedById: s.user.id, reviewedAt: new Date() } })
  await audit(s.principal, { action: 'evidence.grade', entityType: 'Evidence', entityId: id, before: { category: before.qualityReviewerCategory }, after: { prelim, final, rubric: RUBRIC_VERSION }, reason })
  revalidatePath(`/evidence/${id}`)
}
