import type { ApplicationType, FormulaStatus, Prisma, Visibility } from '@prisma/client'
import { prisma } from '../db'
import { audit } from '../audit'
import { can, canViewRecord, type Principal } from '../permissions'
import { validateFormula, compareVersions } from '../formula-math'
import { reindexFormula } from '../search-index'
import { requestReview } from './review'
import { upsertEdge } from './graph'

export class FormulaError extends Error {}

export interface FormulaLineInput {
  ingredientId?: string | null
  rawMaterialId?: string | null
  displayName: string
  phase?: string | null
  percent?: number | null
  isQs?: boolean
  functionalRole?: string | null
  additionOrder?: number | null
  processingNotes?: string | null
  lot?: string | null
}

export interface FormulaCreateInput {
  code: string
  name: string
  visibility?: Visibility
  isSample?: boolean
  productCategory?: string
  applicationType?: ApplicationType
  targetPh?: number | null
  intendedGoals?: string[]
  intendedPhenotypeCodes?: string[]
  preservationSystem?: string
  manufacturingProcess?: string
  notes?: string
  lines: FormulaLineInput[]
}

// Statuses that require human chemist approval (and, for study use, safety approval). AI/API keys can never set them.
const GATED: FormulaStatus[] = ['PROTOTYPE', 'STABILITY_TESTING', 'COMPATIBILITY_TESTING', 'SAFETY_ASSESSMENT', 'APPROVED_FOR_CONTROLLED_STUDY', 'APPROVED_FOR_MANUFACTURING']

async function lineData(lines: FormulaLineInput[]) {
  const rawIds = lines.map((l) => l.rawMaterialId).filter(Boolean) as string[]
  const raws = await prisma.rawMaterial.findMany({ where: { id: { in: rawIds } } })
  const v = validateFormula(lines.map((l) => {
    const rm = raws.find((r) => r.id === l.rawMaterialId)
    return { displayName: l.displayName, percent: l.percent ?? null, isQs: Boolean(l.isQs), phase: l.phase, rawMaterialActivePercent: rm?.activePercent ? Number(rm.activePercent) : null, rawMaterialActiveConfirmed: rm?.activePercentConfirmed ?? false }
  }))
  const data = lines.map((l, idx) => ({
    ingredientId: l.ingredientId ?? null, rawMaterialId: l.rawMaterialId ?? null, displayName: l.displayName, phase: l.phase ?? null,
    percent: l.isQs ? v.qsAmount : (l.percent ?? null), isQs: Boolean(l.isQs), functionalRole: l.functionalRole ?? null,
    additionOrder: l.additionOrder ?? idx + 1, processingNotes: l.processingNotes ?? null, lot: l.lot ?? null,
    activeConcentration: v.activeLevels[idx].activePercent,
  }))
  return { validation: v, data }
}

export async function createFormula(actor: Principal, input: FormulaCreateInput) {
  if (!can(actor, 'formula:write')) throw new FormulaError('Not permitted to create formulas.')
  if (input.lines.some((l) => !l.ingredientId && !l.rawMaterialId)) throw new FormulaError('Every line must reference an ingredient or a raw material.')
  const { validation, data } = await lineData(input.lines)
  const { formula, version } = await prisma.$transaction(async (tx) => {
    const f = await tx.formula.create({ data: { code: input.code, name: input.name, ownerOrgId: actor.organizationId, visibility: input.visibility ?? 'RESTRICTED', isSample: input.isSample ?? false, productCategory: input.productCategory, createdById: actor.kind === 'USER' ? actor.id : null } })
    const v = await tx.formulaVersion.create({
      data: {
        formulaId: f.id, versionNumber: 1, status: 'CONCEPT', applicationType: input.applicationType ?? 'UNKNOWN', targetPh: input.targetPh ?? null,
        intendedGoals: input.intendedGoals ?? [], intendedPhenotypeCodes: input.intendedPhenotypeCodes ?? [], preservationSystem: input.preservationSystem,
        manufacturingProcess: input.manufacturingProcess, notes: input.notes, createdById: actor.kind === 'USER' ? actor.id : null, lines: { create: data },
      },
    })
    await audit(actor, { action: 'formula.create', entityType: 'Formula', entityId: f.id, after: { code: f.code, version: 1, valid: validation.valid, errors: validation.errors } }, tx)
    for (const l of data) if (l.ingredientId) await upsertEdge(actor, { fromType: 'Ingredient', fromId: l.ingredientId, toType: 'Formula', toId: f.id, edgeType: 'USED_IN', confidence: 1, evidenceType: 'INTERNAL_FORMULA', properties: { version: v.versionNumber } }, tx)
    return { formula: f, version: v }
  })
  await reindexFormula(formula.id)
  return { formula, version, validation }
}

/** Creates a new version from an existing one; the source version is locked so history cannot change. */
export async function newVersion(actor: Principal, formulaId: string, fromVersionId: string, lines?: FormulaLineInput[], notes?: string) {
  await assertCanEdit(actor, formulaId)
  const from = await prisma.formulaVersion.findUniqueOrThrow({ where: { id: fromVersionId }, include: { lines: true } })
  const last = await prisma.formulaVersion.findFirstOrThrow({ where: { formulaId }, orderBy: { versionNumber: 'desc' } })
  const src: FormulaLineInput[] = lines ?? from.lines.map((l) => ({ ingredientId: l.ingredientId, rawMaterialId: l.rawMaterialId, displayName: l.displayName, phase: l.phase, percent: l.percent === null ? null : Number(l.percent), isQs: l.isQs, functionalRole: l.functionalRole, additionOrder: l.additionOrder, processingNotes: l.processingNotes, lot: l.lot }))
  const { validation, data } = await lineData(src)
  const created = await prisma.$transaction(async (tx) => {
    await tx.formulaVersion.update({ where: { id: from.id }, data: { locked: true } })
    const v = await tx.formulaVersion.create({
      data: {
        formulaId, versionNumber: last.versionNumber + 1, status: 'CONCEPT', applicationType: from.applicationType, targetPh: from.targetPh, intendedGoals: from.intendedGoals,
        intendedPhenotypeCodes: from.intendedPhenotypeCodes, preservationSystem: from.preservationSystem, manufacturingProcess: from.manufacturingProcess, notes: notes ?? from.notes,
        createdById: actor.kind === 'USER' ? actor.id : null, lines: { create: data },
      },
    })
    await audit(actor, { action: 'formula.version.create', entityType: 'FormulaVersion', entityId: v.id, after: { versionNumber: v.versionNumber, from: from.versionNumber, valid: validation.valid } }, tx)
    return v
  })
  return { version: created, validation }
}

export async function duplicateFormula(actor: Principal, formulaId: string, newCode: string, newName: string) {
  const f = await assertCanEdit(actor, formulaId)
  const latest = await prisma.formulaVersion.findFirstOrThrow({ where: { formulaId }, orderBy: { versionNumber: 'desc' }, include: { lines: true } })
  const res = await createFormula(actor, {
    code: newCode, name: newName, visibility: f.visibility, isSample: f.isSample, productCategory: f.productCategory ?? undefined, applicationType: latest.applicationType,
    targetPh: latest.targetPh ? Number(latest.targetPh) : null, intendedGoals: latest.intendedGoals, notes: `Duplicated from ${f.code} v${latest.versionNumber}`,
    lines: latest.lines.map((l) => ({ ingredientId: l.ingredientId, rawMaterialId: l.rawMaterialId, displayName: l.displayName, phase: l.phase, percent: l.percent === null ? null : Number(l.percent), isQs: l.isQs, functionalRole: l.functionalRole })),
  })
  await prisma.formula.update({ where: { id: res.formula.id }, data: { duplicatedFromId: formulaId } })
  return res
}

async function assertCanEdit(actor: Principal, formulaId: string) {
  const f = await prisma.formula.findUniqueOrThrow({ where: { id: formulaId } })
  if (!can(actor, 'formula:write') || !canViewRecord(actor, f)) throw new FormulaError('Not permitted to edit this formula.')
  return f
}

/** Status changes. Gated statuses need a human chemist approval recorded through the review workflow. */
export async function setStatus(actor: Principal, versionId: string, status: FormulaStatus, reason: string) {
  const v = await prisma.formulaVersion.findUniqueOrThrow({ where: { id: versionId }, include: { formula: true } })
  await assertCanEdit(actor, v.formulaId)
  if (actor.kind !== 'USER' && status !== 'CONCEPT' && status !== 'RESEARCH_CANDIDATE') throw new FormulaError('Automated clients may only create concepts or research candidates.')
  if (status === 'CHEMIST_REVIEW') {
    await requestReview(actor, { entityType: 'FormulaVersion', entityId: v.id, recordType: 'FormulaVersion', title: `Chemist review: ${v.formula.code} v${v.versionNumber}`, reviewType: 'FORMULA' })
  }
  if (GATED.includes(status) && v.chemistReviewStatus !== 'APPROVED') throw new FormulaError('Candidate for cosmetic-chemist review: a qualified chemist must approve this version before it can move to prototype or later stages.')
  if ((status === 'APPROVED_FOR_CONTROLLED_STUDY' || status === 'APPROVED_FOR_MANUFACTURING') && v.safetyReviewStatus !== 'APPROVED') throw new FormulaError('Safety review approval is required for this status.')
  if (status === 'APPROVED_FOR_MANUFACTURING' && !can(actor, 'formula:approve_testing')) throw new FormulaError('Only a cosmetic chemist can set this status.')
  const updated = await prisma.formulaVersion.update({ where: { id: versionId }, data: { status } })
  await audit(actor, { action: 'formula.status', entityType: 'FormulaVersion', entityId: versionId, before: { status: v.status }, after: { status }, reason })
  return updated
}

export async function getFormulaForPrincipal(actor: Principal, formulaId: string) {
  const f = await prisma.formula.findUnique({ where: { id: formulaId }, include: { versions: { orderBy: { versionNumber: 'desc' }, include: { lines: { orderBy: { additionOrder: 'asc' }, include: { ingredient: true, rawMaterial: true } } } } } })
  if (!f || !can(actor, 'formula:read') || !canViewRecord(actor, f)) return null
  return f
}

const ALLERGEN_FAMILIES = new Set(['fragrance-allergens'])

/** Builds the research summary for a version: validation, allergens, regulatory flags, compatibility, gaps, evidence. */
export async function summarizeVersion(versionId: string) {
  const v = await prisma.formulaVersion.findUniqueOrThrow({ where: { id: versionId }, include: { lines: { include: { ingredient: { include: { family: true, regulatory: { where: { supersededAt: null } }, safetyReviews: true, evidenceLinks: { include: { evidence: true } }, functions: { include: { function: true } } } }, rawMaterial: true } } } })
  const validation = validateFormula(v.lines.map((l) => ({ id: l.id, displayName: l.displayName, percent: l.percent === null ? null : Number(l.percent), isQs: l.isQs, phase: l.phase, rawMaterialActivePercent: l.rawMaterial?.activePercent ? Number(l.rawMaterial.activePercent) : null, rawMaterialActiveConfirmed: l.rawMaterial?.activePercentConfirmed ?? false })))
  const ingredients = v.lines.filter((l) => l.ingredient).map((l) => l.ingredient!)
  const allergens = ingredients.filter((i) => ALLERGEN_FAMILIES.has(i.family?.slug ?? '') || i.safetyReviews.some((s) => s.endpoint === 'SENSITIZATION')).map((i) => i.displayName)
  const regulatory = v.lines.flatMap((l) => (l.ingredient?.regulatory ?? []).filter((r) => r.status !== 'ALLOWED' && r.status !== 'NOT_LISTED').map((r) => {
    const pct = l.ingredientId && !l.rawMaterialId && l.percent !== null ? Number(l.percent) : null
    const exceeds = pct !== null && r.maxConcentration !== null && r.maxConcentrationUnit?.includes('%') ? pct > Number(r.maxConcentration) : null
    return { ingredient: l.displayName, jurisdiction: r.jurisdiction, status: r.status, max: r.maxConcentration ? `${r.maxConcentration} ${r.maxConcentrationUnit ?? ''}` : null, linePercent: pct, exceeds, reviewStatus: r.reviewStatus, restriction: r.productRestrictions }
  }))
  const ingIds = ingredients.map((i) => i.id)
  const incompat = ingIds.length ? await prisma.graphEdge.findMany({ where: { edgeType: 'INCOMPATIBLE_WITH', fromType: 'Ingredient', toType: 'Ingredient', fromId: { in: ingIds }, toId: { in: ingIds }, supersededAt: null } }) : []
  const fn = (i: (typeof ingredients)[number]) => i.functions.map((f) => f.function.code)
  const cationic = ingredients.filter((i) => fn(i).includes('cationic-conditioner')).map((i) => i.displayName)
  const anionic = ingredients.filter((i) => i.family?.slug === 'anionic-surfactants').map((i) => i.displayName)
  const compatibility = [
    ...incompat.map((e) => ({ kind: 'RECORDED_INCOMPATIBILITY', message: `Recorded incompatibility between ${ingredients.find((i) => i.id === e.fromId)?.displayName} and ${ingredients.find((i) => i.id === e.toId)?.displayName}.` })),
    ...(cationic.length && anionic.length ? [{ kind: 'HEURISTIC', message: `Cationic conditioner(s) (${cationic.join(', ')}) with anionic surfactant(s) (${anionic.join(', ')}): possible complexation/precipitation. Heuristic only — requires chemist review.` }] : []),
  ]
  const unresolved = [
    ...v.lines.filter((l) => !l.ingredientId && !l.rawMaterialId).map((l) => `"${l.displayName}" has no canonical ingredient or raw material.`),
    ...ingredients.filter((i) => i.reviewStatus !== 'APPROVED').map((i) => `${i.displayName}: identity not yet reviewed.`),
    ...validation.activeLevels.filter((a) => a.activePercent === null && v.lines.find((l) => l.id === a.id)?.rawMaterialId).map((a) => `${a.displayName}: active level unknown (${a.reason})`),
  ]
  const evidence = ingredients.map((i) => ({ ingredient: i.displayName, records: i.evidenceLinks.length, maxLevel: Math.max(0, ...i.evidenceLinks.map((l) => l.evidence.evidenceLevel ?? 0)), reviewed: i.evidenceLinks.filter((l) => l.evidence.reviewStatus === 'APPROVED').length }))
  return { validation, allergens, regulatory, compatibility, unresolved, evidence, cost: { available: false, message: 'Cost estimate requires numeric raw-material prices; none are recorded.' } }
}

export async function compare(versionAId: string, versionBId: string) {
  const [a, b] = await Promise.all([versionAId, versionBId].map((id) => prisma.formulaVersion.findUniqueOrThrow({ where: { id }, include: { lines: true } })))
  const key = (l: { ingredientId: string | null; rawMaterialId: string | null; displayName: string }) => l.rawMaterialId ?? l.ingredientId ?? l.displayName
  const map = (ls: typeof a.lines) => ls.map((l) => ({ key: key(l), displayName: l.displayName, percent: l.percent === null ? null : Number(l.percent), isQs: l.isQs }))
  return { a, b, diff: compareVersions(map(a.lines), map(b.lines)) }
}

export type FormulaWithVersions = Prisma.PromiseReturnType<typeof getFormulaForPrincipal>
