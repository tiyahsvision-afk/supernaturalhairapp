import type { AliasType, IdentifierType, IdentityType, MaterialType, OriginType, Prisma } from '@prisma/client'
import { prisma } from '../db'
import { audit } from '../audit'
import type { Principal } from '../permissions'
import { isValidCas, isValidEc, normalizeIdentifier, normalizeName, slugify } from '../normalize'
import { reindexIngredient } from '../search-index'
import { requestReview } from './review'
import { computeCompleteness } from '../completeness'
import { detectConflicts } from './facts'
import { isStale } from '../regulatory'

export class IngredientError extends Error {
  constructor(message: string, public existingId?: string) { super(message) }
}

type Tx = Prisma.TransactionClient | typeof prisma

export interface IngredientCreateInput {
  slug?: string
  canonicalName: string
  inciName?: string | null
  displayName?: string
  commonName?: string | null
  chemicalName?: string | null
  description?: string | null
  identityType: IdentityType
  materialType: MaterialType
  originType?: OriginType
  familySlug?: string | null
  priorityTier?: number | null
  priorityReason?: string | null
  identityNote?: string | null
  aliases?: { alias: string; type?: AliasType }[]
  sourceId?: string | null
}

/**
 * Creates a canonical ingredient. An exact normalized-name collision is rejected (pointing to the existing record);
 * near matches are queued for identity review — never merged automatically.
 */
export async function createIngredient(actor: Principal | null, input: IngredientCreateInput, tx: Tx = prisma, opts: { requestReview?: boolean } = { requestReview: true }) {
  const norm = normalizeName(input.canonicalName)
  const collision = await tx.ingredient.findFirst({ where: { status: 'ACTIVE', OR: [{ names: { some: { normalized: norm } } }, { slug: input.slug ?? slugify(input.canonicalName) }] } })
  if (collision) throw new IngredientError(`An ingredient with this name already exists: ${collision.displayName}`, collision.id)
  const family = input.familySlug ? await tx.ingredientFamily.findUnique({ where: { slug: input.familySlug } }) : null
  const ing = await tx.ingredient.create({
    data: {
      slug: input.slug ?? slugify(input.canonicalName), canonicalName: input.canonicalName, inciName: input.inciName ?? null, displayName: input.displayName ?? input.commonName ?? input.canonicalName,
      commonName: input.commonName ?? null, chemicalName: input.chemicalName ?? null, description: input.description ?? null, identityType: input.identityType, materialType: input.materialType,
      originType: input.originType ?? 'UNKNOWN', familyId: family?.id ?? null, priorityTier: input.priorityTier ?? null, priorityReason: input.priorityReason ?? null, identityNote: input.identityNote ?? null,
      names: {
        create: [
          { name: input.canonicalName, normalized: norm, nameType: input.inciName === input.canonicalName ? 'INCI' : 'DISPLAY', isPreferred: true, sourceId: input.sourceId ?? null },
          ...(input.inciName && input.inciName !== input.canonicalName ? [{ name: input.inciName, normalized: normalizeName(input.inciName), nameType: 'INCI' as const, sourceId: input.sourceId ?? null }] : []),
          ...(input.commonName && normalizeName(input.commonName) !== norm ? [{ name: input.commonName, normalized: normalizeName(input.commonName), nameType: 'COMMON' as const, sourceId: input.sourceId ?? null }] : []),
        ],
      },
    },
  })
  const seen = new Set([norm, normalizeName(input.inciName ?? ''), normalizeName(input.commonName ?? '')])
  for (const a of input.aliases ?? []) {
    const n = normalizeName(a.alias)
    if (!n || seen.has(n)) continue
    seen.add(n)
    await tx.ingredientAlias.create({ data: { ingredientId: ing.id, alias: a.alias, normalized: n, aliasType: a.type ?? 'SYNONYM', sourceId: input.sourceId ?? null } })
  }
  await audit(actor, { action: 'ingredient.create', entityType: 'Ingredient', entityId: ing.id, after: input, sourceId: input.sourceId ?? null }, tx)
  if (opts.requestReview) await requestReview(actor, { entityType: 'Ingredient', entityId: ing.id, title: `Identity review: ${ing.displayName}` }, tx)
  await reindexIngredient(ing.id, tx)
  return ing
}

export async function updateIngredient(actor: Principal, id: string, patch: Partial<Pick<IngredientCreateInput, 'displayName' | 'commonName' | 'chemicalName' | 'description' | 'inciName' | 'identityNote'>> & { originType?: OriginType; materialType?: MaterialType; identityType?: IdentityType }, reason: string) {
  if (!reason?.trim()) throw new IngredientError('A reason is required for every change.')
  return prisma.$transaction(async (tx) => {
    const before = await tx.ingredient.findUniqueOrThrow({ where: { id } })
    const updated = await tx.ingredient.update({ where: { id }, data: { ...patch, version: { increment: 1 }, reviewStatus: 'RE_REVIEW_REQUIRED' } })
    await audit(actor, { action: 'ingredient.update', entityType: 'Ingredient', entityId: id, before, after: updated, reason }, tx)
    await requestReview(actor, { entityType: 'Ingredient', entityId: id, title: `Re-review after edit: ${updated.displayName}` }, tx)
    await reindexIngredient(id, tx)
    return updated
  })
}

export async function addAlias(actor: Principal | null, ingredientId: string, alias: string, aliasType: AliasType = 'SYNONYM', sourceId?: string | null, tx: Tx = prisma) {
  const normalized = normalizeName(alias)
  const row = await tx.ingredientAlias.upsert({ where: { ingredientId_normalized: { ingredientId, normalized } }, update: {}, create: { ingredientId, alias, normalized, aliasType, sourceId: sourceId ?? null } })
  await audit(actor, { action: 'ingredient.alias.add', entityType: 'Ingredient', entityId: ingredientId, after: { alias, aliasType } }, tx)
  await reindexIngredient(ingredientId, tx)
  return row
}

/**
 * Adds an identifier. Invalid CAS/EC checksums are rejected. An identifier already attached to a different ingredient
 * is stored as CONFLICT and quarantined — the two records are not merged.
 */
export async function addIdentifier(actor: Principal | null, input: { ingredientId: string; type: IdentifierType; value: string; sourceId?: string | null; sourceLocation?: string; verificationStatus?: 'UNVERIFIED' | 'VERIFIED' | 'NEEDS_REVIEW'; isRepresentative?: boolean; confidence?: number }, tx: Tx = prisma) {
  if (input.type === 'CAS' && !isValidCas(input.value)) throw new IngredientError(`Invalid CAS number (checksum failed): ${input.value}`)
  if (input.type === 'EC' && !isValidEc(input.value)) throw new IngredientError(`Invalid EC number (checksum failed): ${input.value}`)
  const normalized = normalizeIdentifier(input.type, input.value)
  const elsewhere = await tx.ingredientIdentifier.findFirst({ where: { type: input.type, normalized, ingredientId: { not: input.ingredientId }, supersededAt: null, verificationStatus: { not: 'REJECTED' } } })
  const status = elsewhere ? 'CONFLICT' : (input.verificationStatus ?? 'UNVERIFIED')
  const row = await tx.ingredientIdentifier.upsert({
    where: { ingredientId_type_normalized: { ingredientId: input.ingredientId, type: input.type, normalized } },
    update: {},
    create: { ingredientId: input.ingredientId, type: input.type, value: input.value, normalized, sourceId: input.sourceId ?? null, sourceLocation: input.sourceLocation, verificationStatus: status, isRepresentative: input.isRepresentative ?? false, confidence: input.confidence },
  })
  if (elsewhere) {
    await tx.quarantineItem.upsert({
      where: { dedupeKey: `idconflict:${input.type}:${normalized}` },
      update: {},
      create: { queue: input.type === 'CAS' ? 'CONFLICTING_CAS' : 'IDENTIFIER_MISMATCH', entityType: 'IngredientIdentifier', entityId: row.id, dedupeKey: `idconflict:${input.type}:${normalized}`, payload: { type: input.type, value: input.value, ingredientIds: [input.ingredientId, elsewhere.ingredientId] }, reason: `${input.type} ${input.value} is attached to two different ingredients.` },
    })
  }
  await audit(actor, { action: 'ingredient.identifier.add', entityType: 'Ingredient', entityId: input.ingredientId, after: { type: input.type, value: input.value, status } }, tx)
  await reindexIngredient(input.ingredientId, tx)
  return row
}

export interface IngredientFilters {
  functionCode?: string
  materialType?: MaterialType
  identityType?: IdentityType
  familySlug?: string
  priorityTier?: number
  minEvidenceLevel?: number
  humanEvidence?: boolean
  texturedHairEvidence?: boolean
  regulatoryJurisdiction?: string
  regulatoryStatus?: string
  hasSupplierDocuments?: boolean
  leaveOnCompatible?: boolean
  unresolvedSafety?: boolean
  inSupernaturalProduct?: boolean
}

export function ingredientWhere(f: IngredientFilters): Prisma.IngredientWhereInput {
  const and: Prisma.IngredientWhereInput[] = [{ status: 'ACTIVE' }]
  if (f.functionCode) and.push({ functions: { some: { function: { code: f.functionCode } } } })
  if (f.materialType) and.push({ materialType: f.materialType })
  if (f.identityType) and.push({ identityType: f.identityType })
  if (f.familySlug) and.push({ family: { slug: f.familySlug } })
  if (f.priorityTier) and.push({ priorityTier: f.priorityTier })
  if (f.minEvidenceLevel) and.push({ evidenceLinks: { some: { evidence: { evidenceLevel: { gte: f.minEvidenceLevel } } } } })
  if (f.humanEvidence) and.push({ evidenceLinks: { some: { evidence: { studyType: { in: ['CONTROLLED_HUMAN', 'HUMAN_OBSERVATIONAL'] } } } } })
  if (f.texturedHairEvidence) and.push({ evidenceLinks: { some: { evidence: { texturedHairRelevant: true } } } })
  if (f.regulatoryJurisdiction || f.regulatoryStatus) and.push({ regulatory: { some: { supersededAt: null, ...(f.regulatoryJurisdiction ? { jurisdiction: f.regulatoryJurisdiction } : {}), ...(f.regulatoryStatus ? { status: f.regulatoryStatus as never } : {}) } } })
  if (f.hasSupplierDocuments) and.push({ rawComponents: { some: { rawMaterial: { documents: { some: {} } } } } })
  if (f.leaveOnCompatible) and.push({ NOT: { concentrations: { some: { recordType: 'REGULATORY_MAXIMUM', applicationType: 'LEAVE_ON', maxValue: 0 } } } }, { NOT: { regulatory: { some: { supersededAt: null, productRestrictions: { contains: 'rinse-off only', mode: 'insensitive' } } } } })
  if (f.unresolvedSafety) and.push({ safetyReviews: { some: { reviewStatus: { not: 'APPROVED' } } } })
  if (f.inSupernaturalProduct) and.push({ productLines: { some: { productVersion: { validTo: null, product: { isSupernatural: true } } } } })
  return { AND: and }
}

/** Full ingredient profile with provenance, conflicts, staleness and completeness. */
export async function ingredientDetail(id: string) {
  const ing = await prisma.ingredient.findUnique({
    where: { id },
    include: {
      family: true,
      names: { orderBy: { nameType: 'asc' } },
      aliases: { orderBy: { alias: 'asc' } },
      identifiers: { orderBy: { type: 'asc' } },
      complexProfile: { include: { botanicalSource: true, extractionMethod: true, fermentationSource: true } },
      facts: { orderBy: [{ propertyType: 'asc' }, { createdAt: 'desc' }] },
      functions: { include: { function: true } },
      concentrations: { orderBy: { recordType: 'asc' } },
      regulatory: { orderBy: [{ jurisdiction: 'asc' }, { createdAt: 'desc' }] },
      safetyReviews: true,
      evidenceLinks: { include: { evidence: true, ontologyTerm: true } },
      patentLinks: { include: { patent: true } },
      rawComponents: { include: { rawMaterial: { include: { supplier: true } } } },
      productLines: { include: { productVersion: { include: { product: true } } } },
      formulaLines: { include: { formulaVersion: { include: { formula: true } } } },
      relationsFrom: { include: { to: true } },
      relationsTo: { include: { from: true } },
    },
  })
  if (!ing) return null
  const sourceIds = [...new Set([...ing.facts.map((f) => f.sourceId), ...ing.regulatory.map((r) => r.sourceId), ...ing.functions.map((f) => f.sourceId), ...ing.identifiers.map((i) => i.sourceId).filter(Boolean) as string[], ...ing.concentrations.map((c) => c.sourceId), ...ing.safetyReviews.map((s) => s.sourceId)])]
  const sources = await prisma.source.findMany({ where: { id: { in: sourceIds } } })
  const completeness = computeCompleteness({
    identityType: ing.identityType, inciName: ing.inciName, description: ing.description, familyId: ing.familyId,
    verifiedIdentifierCount: ing.identifiers.filter((i) => i.verificationStatus === 'VERIFIED' && !i.supersededAt).length,
    functionCount: ing.functions.length, factCount: ing.facts.filter((f) => !f.supersededAt).length,
    regulatoryJurisdictions: new Set(ing.regulatory.filter((r) => !r.supersededAt).map((r) => r.jurisdiction)).size,
    safetyReviewCount: ing.safetyReviews.length, evidenceCount: ing.evidenceLinks.length, concentrationCount: ing.concentrations.length,
    hasComplexProfile: Boolean(ing.complexProfile),
  })
  const conflicts = detectConflicts(ing.facts)
  const staleRegulatory = ing.regulatory.filter((r) => !r.supersededAt && isStale(r)).map((r) => r.id)
  const edges = await prisma.graphEdge.count({ where: { OR: [{ fromType: 'Ingredient', fromId: id }, { toType: 'Ingredient', toId: id }] } })
  return { ing, sources: new Map(sources.map((s) => [s.id, s])), completeness, conflicts, staleRegulatory, edgeCount: edges }
}
