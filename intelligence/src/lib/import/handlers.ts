import type { ApplicationType, EntryMode, IdentityType, ImportOutcome, MaterialType, OriginType, PropertyType, RegulatoryStatus, StudyType } from '@prisma/client'
import { prisma } from '../db'
import type { Principal } from '../permissions'
import { normalizeName, slugify } from '../normalize'
import { createIngredient, addAlias, addIdentifier, IngredientError } from '../services/ingredients'
import { upsertProduct, recordProductVersion } from '../services/products'
import { createFact } from '../services/facts'
import { upsertEdge } from '../services/graph'
import { buildNameIndex, matchName, type NameIndex } from '../services/matching'
import { reindexEvidence, reindexPatent } from '../search-index'
import { requestReview } from '../services/review'

export interface ImportContext { actor: Principal | null; jobId: string; sourceId: string; cache: Map<string, unknown> }
export interface HandlerResult { outcome: ImportOutcome; entityId?: string; externalKey?: string; message?: string }
type Handler = (row: Record<string, unknown>, ctx: ImportContext, hash: string) => Promise<HandlerResult>

const str = (v: unknown) => (v === null || v === undefined ? '' : String(v)).trim()
const list = (v: unknown) => (Array.isArray(v) ? v.map(String) : str(v).split(/[;|]/)).map((s) => s.trim()).filter(Boolean)
const num = (v: unknown) => { const s = str(v); if (!s) return null; const n = Number(s); return Number.isFinite(n) ? n : NaN }

/** ExternalRef lookup: returns UNCHANGED when the same row was already imported from this source. */
async function checkRef(ctx: ImportContext, entityType: string, externalId: string, hash: string) {
  const ref = await prisma.externalRef.findUnique({ where: { sourceId_entityType_externalId: { sourceId: ctx.sourceId, entityType, externalId } } })
  if (ref && ref.contentHash === hash) {
    await prisma.externalRef.update({ where: { id: ref.id }, data: { lastSeenAt: new Date() } })
    return { state: 'UNCHANGED' as const, ref }
  }
  return { state: ref ? ('CHANGED' as const) : ('NEW' as const), ref }
}

async function saveRef(ctx: ImportContext, entityType: string, externalId: string, entityId: string, hash: string) {
  await prisma.externalRef.upsert({
    where: { sourceId_entityType_externalId: { sourceId: ctx.sourceId, entityType, externalId } },
    update: { contentHash: hash, entityId, lastSeenAt: new Date() },
    create: { sourceId: ctx.sourceId, entityType, externalId, entityId, contentHash: hash },
  })
}

async function nameIndex(ctx: ImportContext): Promise<NameIndex> {
  if (!ctx.cache.has('nameIndex')) ctx.cache.set('nameIndex', await buildNameIndex())
  return ctx.cache.get('nameIndex') as NameIndex
}

/** Resolves an ingredient reference given as slug, exact name or alias. Never fuzzy. */
async function resolveIngredient(ctx: ImportContext, ref: string) {
  const bySlug = await prisma.ingredient.findUnique({ where: { slug: ref } })
  if (bySlug) return bySlug.status === 'MERGED' && bySlug.mergedIntoId ? prisma.ingredient.findUnique({ where: { id: bySlug.mergedIntoId } }) : bySlug
  const m = matchName(await nameIndex(ctx), ref)
  return m.status === 'MATCHED' && m.ingredientId ? prisma.ingredient.findUnique({ where: { id: m.ingredientId } }) : null
}

const ingredient: Handler = async (row, ctx, hash) => {
  const name = str(row.canonical_name ?? row.canonicalName ?? row.name)
  if (!name) return { outcome: 'REJECTED', message: 'canonical_name is required.' }
  const externalId = str(row.external_id ?? row.slug) || slugify(name)
  const check = await checkRef(ctx, 'ingredient', externalId, hash)
  if (check.state === 'UNCHANGED') return { outcome: 'UNCHANGED', entityId: check.ref!.entityId, externalKey: externalId }
  if (check.state === 'CHANGED') {
    // Identity fields of an existing canonical ingredient are not overwritten by imports; new aliases are added.
    for (const a of list(row.aliases)) await addAlias(ctx.actor, check.ref!.entityId, a, 'SYNONYM', ctx.sourceId)
    await saveRef(ctx, 'ingredient', externalId, check.ref!.entityId, hash)
    return { outcome: 'UPDATED', entityId: check.ref!.entityId, externalKey: externalId, message: 'Aliases merged; identity fields require manual edit.' }
  }
  const identityType = (str(row.identity_type) || 'UNKNOWN_COMPOSITION') as IdentityType
  const materialType = (str(row.material_type) || 'OTHER') as MaterialType
  let ing
  try {
    ing = await createIngredient(ctx.actor, {
      canonicalName: name, inciName: str(row.inci_name) || null, commonName: str(row.common_name) || null, description: str(row.description) || null,
      identityType, materialType, originType: (str(row.origin_type) || 'UNKNOWN') as OriginType, familySlug: str(row.family) || null,
      priorityTier: num(row.priority_tier) || null, aliases: list(row.aliases).map((a) => ({ alias: a })), sourceId: ctx.sourceId,
    })
  } catch (e) {
    if (e instanceof IngredientError && e.existingId) {
      await prisma.quarantineItem.upsert({ where: { dedupeKey: `dup-ing:${ctx.sourceId}:${externalId}` }, update: {}, create: { queue: 'UNRESOLVED_IDENTITY', importJobId: ctx.jobId, dedupeKey: `dup-ing:${ctx.sourceId}:${externalId}`, payload: { row, existingId: e.existingId } as object, reason: `Possible duplicate of existing ingredient (${e.message}). Not merged automatically.` } })
      return { outcome: 'DUPLICATE', entityId: e.existingId, externalKey: externalId, message: e.message }
    }
    throw e
  }
  const warnings: string[] = []
  for (const [type, key] of [['CAS', 'cas'], ['EC', 'ec'], ['PUBCHEM_CID', 'pubchem_cid'], ['DTXSID', 'dtxsid'], ['INCHIKEY', 'inchikey']] as const) {
    const v = str(row[key])
    if (!v) continue
    try { await addIdentifier(ctx.actor, { ingredientId: ing.id, type, value: v, sourceId: ctx.sourceId, verificationStatus: 'UNVERIFIED' }) } catch (e) {
      warnings.push((e as Error).message)
      await prisma.quarantineItem.create({ data: { queue: 'IDENTIFIER_MISMATCH', importJobId: ctx.jobId, entityType: 'Ingredient', entityId: ing.id, payload: { type, value: v }, reason: (e as Error).message } })
    }
  }
  for (const code of list(row.functions)) {
    const fn = await prisma.functionTerm.findUnique({ where: { code } })
    if (!fn) { warnings.push(`Unknown function code "${code}"`); continue }
    await prisma.ingredientFunction.create({ data: { ingredientId: ing.id, functionId: fn.id, sourceId: ctx.sourceId, basis: 'SOURCE_DECLARED', entryMode: 'IMPORTED' } })
  }
  await saveRef(ctx, 'ingredient', externalId, ing.id, hash)
  return { outcome: warnings.length ? 'WARNING' : 'CREATED', entityId: ing.id, externalKey: externalId, message: warnings.join('; ') || undefined }
}

const product: Handler = async (row, ctx) => {
  const brand = str(row.brand), name = str(row.name ?? row.product_name), listRaw = str(row.ingredient_list ?? row.ingredients)
  if (!brand || !name || !listRaw) return { outcome: 'REJECTED', message: 'brand, name and ingredient_list are required.' }
  const { product: p, created } = await upsertProduct(ctx.actor, {
    slug: str(row.slug) || undefined, brand, name, category: str(row.category) || undefined, market: str(row.market) || undefined,
    applicationType: (str(row.application_type) || 'UNKNOWN') as ApplicationType, isSupernatural: str(row.is_supernatural) === 'true' || row.is_supernatural === true,
    barcode: str(row.barcode) || null, purchaseUrl: str(row.purchase_url) || null,
  })
  const v = await recordProductVersion(ctx.actor, p.id, {
    ingredientListRaw: listRaw, ingredientListSource: str(row.ingredient_list_source) || 'MANUFACTURER_WEBSITE', sourceUrl: str(row.source_url) || null, sourceId: ctx.sourceId,
    validFrom: str(row.valid_from) ? new Date(str(row.valid_from)) : undefined, marketingExcerpts: list(row.marketing_excerpts), dataQualityNotes: list(row.data_quality_notes),
  }, await nameIndex(ctx))
  const unresolved = await prisma.productIngredient.count({ where: { productVersionId: v.version.id, parsingStatus: { not: 'MATCHED' } } })
  if (v.outcome === 'UNCHANGED') return { outcome: 'UNCHANGED', entityId: p.id, externalKey: p.slug }
  return { outcome: created ? 'CREATED' : 'UPDATED', entityId: p.id, externalKey: p.slug, message: `${v.outcome === 'CHANGED' ? 'Ingredient list changed; new version created. ' : ''}${unresolved} line(s) need identity review.` }
}

const STUDY_TYPES = new Set(['PEER_REVIEWED_STUDY', 'REVIEW', 'SYSTEMATIC_REVIEW', 'META_ANALYSIS', 'IN_VITRO', 'EX_VIVO', 'ANIMAL', 'HUMAN_OBSERVATIONAL', 'CONTROLLED_HUMAN', 'PROFESSIONAL_CONSENSUS', 'REGULATORY_ASSESSMENT', 'SUPPLIER_STUDY', 'INTERNAL_STUDY', 'CASE_REPORT', 'PATENT_EXAMPLE', 'OTHER'])

const evidence: Handler = async (row, ctx, hash) => {
  const title = str(row.title), pmid = str(row.pmid) || null, doi = str(row.doi).toLowerCase() || null
  if (!title || (!pmid && !doi && !str(row.source_url))) return { outcome: 'REJECTED', message: 'title and one of pmid/doi/source_url are required.' }
  const externalId = pmid ? `pmid:${pmid}` : doi ? `doi:${doi}` : `url:${str(row.source_url)}`
  const check = await checkRef(ctx, 'evidence', externalId, hash)
  if (check.state === 'UNCHANGED') return { outcome: 'UNCHANGED', entityId: check.ref!.entityId, externalKey: externalId }
  // Duplicate-publication detection across sources (same DOI or PMID already present under another record).
  const existing = await prisma.evidence.findFirst({ where: { OR: [...(pmid ? [{ pmid }] : []), ...(doi ? [{ doi }] : [])] } })
  if (existing && check.state === 'NEW') {
    if ((pmid && existing.pmid && existing.pmid !== pmid) || (doi && existing.doi && existing.doi !== doi)) {
      await prisma.quarantineItem.create({ data: { queue: 'DUPLICATE_PUBLICATION', importJobId: ctx.jobId, entityType: 'Evidence', entityId: existing.id, payload: { row } as object, reason: 'DOI/PMID pair conflicts with an existing evidence record.' } })
      return { outcome: 'QUARANTINED', entityId: existing.id, externalKey: externalId, message: 'Conflicting DOI/PMID pair.' }
    }
    await saveRef(ctx, 'evidence', externalId, existing.id, hash)
    return { outcome: 'DUPLICATE', entityId: existing.id, externalKey: externalId, message: 'Publication already present.' }
  }
  const studyType = (STUDY_TYPES.has(str(row.study_type)) ? str(row.study_type) : 'OTHER') as StudyType
  const level = num(row.evidence_level)
  if (level !== null && (Number.isNaN(level) || level < 1 || level > 7)) return { outcome: 'REJECTED', message: 'evidence_level must be 1–7.' }
  const entryMode = (str(row.entry_mode) || 'IMPORTED') as EntryMode
  const data = {
    title, pmid, doi, pmcid: str(row.pmcid) || null, studyType, evidenceLevel: level, journal: str(row.journal) || null, authors: str(row.authors) || null,
    publicationDate: str(row.publication_date) ? new Date(str(row.publication_date)) : null,
    sourceUrl: str(row.source_url) || (pmid ? `https://pubmed.ncbi.nlm.nih.gov/${pmid}/` : `https://doi.org/${doi}`),
    limitations: str(row.limitations) || null, fundingSource: str(row.funding_source) || null, texturedHairRelevant: row.textured_hair === true || str(row.textured_hair) === 'true' ? true : null,
    medicalContext: row.medical_context === true || str(row.medical_context) === 'true', safetyRelevant: row.safety_relevant === true || str(row.safety_relevant) === 'true',
    sourceId: ctx.sourceId, entryMode, extractionStatus: 'METADATA_ONLY',
  }
  const ev = check.state === 'CHANGED' ? await prisma.evidence.update({ where: { id: check.ref!.entityId }, data }) : await prisma.evidence.create({ data })
  for (const ref of list(row.ingredients)) {
    const ing = await resolveIngredient(ctx, ref)
    if (!ing) continue
    const exists = await prisma.evidenceLink.findFirst({ where: { evidenceId: ev.id, ingredientId: ing.id } })
    if (!exists) {
      await prisma.evidenceLink.create({ data: { evidenceId: ev.id, ingredientId: ing.id, role: 'EXPOSURE', direction: (str(row.direction) || 'UNCLEAR') as never, entryMode, statement: str(row.statement) || null } })
      await upsertEdge(ctx.actor, { fromType: 'Ingredient', fromId: ing.id, toType: 'Study', toId: ev.id, edgeType: 'STUDIED_IN', sourceId: ctx.sourceId, confidence: entryMode === 'AI_EXTRACTED' ? 0.5 : 0.8, evidenceType: 'LITERATURE_METADATA' })
    }
  }
  for (const code of list(row.outcomes)) {
    const term = await prisma.ontologyTerm.findUnique({ where: { code } })
    if (!term) continue
    const exists = await prisma.evidenceLink.findFirst({ where: { evidenceId: ev.id, ontologyTermId: term.id } })
    if (!exists) {
      await prisma.evidenceLink.create({ data: { evidenceId: ev.id, ontologyTermId: term.id, role: 'OUTCOME', direction: (str(row.direction) || 'UNCLEAR') as never, entryMode } })
      await upsertEdge(ctx.actor, { fromType: 'Study', fromId: ev.id, toType: term.domain === 'SCALP' ? 'ScalpPhenotype' : term.domain === 'OUTCOME' ? 'Outcome' : 'HairPhenotype', toId: term.id, edgeType: str(row.direction) === 'CONTRADICTS' ? 'CONTRADICTS' : str(row.direction) === 'SUPPORTS' ? 'SUPPORTS' : 'ASSOCIATED_WITH', sourceId: ctx.sourceId, confidence: 0.4, evidenceType: 'LITERATURE_METADATA', notes: 'Proposed from title only; requires evidence review.' })
    }
  }
  await saveRef(ctx, 'evidence', externalId, ev.id, hash)
  await reindexEvidence(ev.id)
  if (check.state === 'NEW') await requestReview(ctx.actor, { entityType: 'Evidence', entityId: ev.id, title: `Evidence review: ${title.slice(0, 80)}`, reviewType: 'EVIDENCE' })
  return { outcome: check.state === 'CHANGED' ? 'UPDATED' : 'CREATED', entityId: ev.id, externalKey: externalId }
}

export function normalizePatentNumber(s: string) {
  return s.toUpperCase().replace(/[\s,./-]/g, '')
}

export function patentJurisdiction(num: string) {
  const m = /^([A-Z]{2})/.exec(num)
  return m ? m[1] : 'UNKNOWN'
}

const patent: Handler = async (row, ctx, hash) => {
  const raw = str(row.publication_number ?? row.number)
  const title = str(row.title)
  if (!raw || !title) return { outcome: 'REJECTED', message: 'publication_number and title are required.' }
  const number = normalizePatentNumber(raw)
  const check = await checkRef(ctx, 'patent', number, hash)
  if (check.state === 'UNCHANGED') return { outcome: 'UNCHANGED', entityId: check.ref!.entityId, externalKey: number }
  const existing = await prisma.patent.findUnique({ where: { publicationNumber: number } })
  if (existing && check.state === 'NEW') {
    await prisma.quarantineItem.upsert({ where: { dedupeKey: `dup-patent:${number}:${ctx.sourceId}` }, update: {}, create: { queue: 'DUPLICATE_PATENT', importJobId: ctx.jobId, entityType: 'Patent', entityId: existing.id, dedupeKey: `dup-patent:${number}:${ctx.sourceId}`, payload: { row } as object, reason: `Patent ${number} already exists (from another source).` } })
    return { outcome: 'DUPLICATE', entityId: existing.id, externalKey: number }
  }
  const data = {
    publicationNumber: number, title, jurisdiction: patentJurisdiction(number), jurisdictions: [patentJurisdiction(number)],
    officialUrl: str(row.official_url) || `https://worldwide.espacenet.com/patent/search?q=pn%3D${number}`, topics: list(row.topics),
    assignees: list(row.assignees), applicants: list(row.applicants), inventors: list(row.inventors), cpcClassifications: list(row.cpc),
    legalStatus: str(row.legal_status) || null, sourceId: ctx.sourceId, entryMode: (str(row.entry_mode) || 'IMPORTED') as EntryMode, lastCheckedAt: new Date(),
  }
  const p = check.state === 'CHANGED' ? await prisma.patent.update({ where: { id: check.ref!.entityId }, data }) : await prisma.patent.create({ data })
  for (const ref of list(row.ingredients)) {
    const ing = await resolveIngredient(ctx, ref)
    if (!ing) continue
    await prisma.patentLink.upsert({ where: { patentId_ingredientId_relation: { patentId: p.id, ingredientId: ing.id, relation: 'MENTIONS_IN_SNIPPET' } }, update: {}, create: { patentId: p.id, ingredientId: ing.id, relation: 'MENTIONS_IN_SNIPPET', entryMode: 'AI_EXTRACTED' } })
    await upsertEdge(ctx.actor, { fromType: 'Ingredient', fromId: ing.id, toType: 'Patent', toId: p.id, edgeType: 'CLAIMED_IN_PATENT', sourceId: ctx.sourceId, confidence: 0.3, evidenceType: 'PATENT_SEARCH_SNIPPET', notes: 'Mention inferred from title/snippet; claims not reviewed. Not evidence of efficacy or freedom to operate.' })
  }
  await saveRef(ctx, 'patent', number, p.id, hash)
  await reindexPatent(p.id)
  return { outcome: check.state === 'CHANGED' ? 'UPDATED' : 'CREATED', entityId: p.id, externalKey: number }
}

const REG_STATUS = new Set(['ALLOWED', 'RESTRICTED', 'PROHIBITED', 'CONDITIONALLY_PERMITTED', 'NOT_LISTED', 'NOT_A_COSMETIC_INGREDIENT', 'UNKNOWN'])

const regulatory: Handler = async (row, ctx, hash) => {
  const ing = await resolveIngredient(ctx, str(row.ingredient))
  if (!ing) return { outcome: 'QUARANTINED', message: `Unknown ingredient "${str(row.ingredient)}".` }
  const jurisdiction = str(row.jurisdiction).toUpperCase(), status = str(row.status).toUpperCase(), regRef = str(row.regulation_ref) || null
  if (!jurisdiction || !REG_STATUS.has(status)) return { outcome: 'REJECTED', message: 'jurisdiction and a valid status are required.' }
  const externalId = `${ing.id}:${jurisdiction}:${regRef ?? ''}`
  const check = await checkRef(ctx, 'regulatory', externalId, hash)
  if (check.state === 'UNCHANGED') return { outcome: 'UNCHANGED', entityId: check.ref!.entityId, externalKey: externalId }
  const max = num(row.max_concentration)
  const data = {
    ingredientId: ing.id, jurisdiction, authority: str(row.authority) || jurisdiction, regulationRef: regRef, status: status as RegulatoryStatus,
    maxConcentration: max !== null && !Number.isNaN(max) ? max : null, maxConcentrationUnit: str(row.max_concentration_unit) || null,
    productRestrictions: str(row.product_restrictions) || null, warningRequirements: str(row.warning_requirements) || null, labelingRequirements: str(row.labeling_requirements) || null,
    preservativeStatus: str(row.preservative_status) || null, colorAdditiveStatus: str(row.color_additive_status) || null,
    effectiveDate: str(row.effective_date) ? new Date(str(row.effective_date)) : null, sourceId: ctx.sourceId, sourceUrl: str(row.source_url) || null,
    lastCheckedAt: str(row.last_checked_at) ? new Date(str(row.last_checked_at)) : null, entryMode: (str(row.entry_mode) || 'IMPORTED') as EntryMode, notes: str(row.notes) || null,
  }
  const created = await prisma.$transaction(async (tx) => {
    const rec = await tx.regulatoryRecord.create({ data })
    if (check.state === 'CHANGED') await tx.regulatoryRecord.update({ where: { id: check.ref!.entityId }, data: { supersededAt: new Date(), supersededById: rec.id, reviewStatus: 'SUPERSEDED' } })
    const conflicting = await tx.regulatoryRecord.findFirst({ where: { ingredientId: ing.id, jurisdiction, supersededAt: null, id: { not: rec.id }, status: { not: data.status }, ...(check.ref ? { NOT: { id: check.ref.entityId } } : {}) } })
    if (conflicting) await tx.quarantineItem.create({ data: { queue: 'REGULATORY_CONFLICT', importJobId: ctx.jobId, entityType: 'RegulatoryRecord', entityId: rec.id, payload: { otherRecordId: conflicting.id, statuses: [conflicting.status, data.status] }, reason: `Conflicting ${jurisdiction} status for ${ing.displayName}: ${conflicting.status} vs ${data.status}.` } })
    return rec
  })
  if (data.status === 'PROHIBITED' || data.status === 'RESTRICTED') await upsertEdge(ctx.actor, { fromType: 'Ingredient', fromId: ing.id, toType: 'Regulation', toId: created.id, edgeType: data.status === 'PROHIBITED' ? 'PROHIBITED_BY' : 'RESTRICTED_BY', sourceId: ctx.sourceId, confidence: 0.6, evidenceType: 'REGULATORY_RECORD', properties: { jurisdiction, regulationRef: regRef } })
  if (data.maxConcentration !== null && data.maxConcentrationUnit) {
    await prisma.concentrationRecord.create({ data: { ingredientId: ing.id, recordType: 'REGULATORY_MAXIMUM', maxValue: data.maxConcentration, unit: data.maxConcentrationUnit, basis: 'ACTIVE', jurisdiction, restriction: data.productRestrictions, applicationType: /rinse-off/i.test(data.productRestrictions ?? '') && !/leave-on/i.test(data.productRestrictions ?? '') ? 'RINSE_OFF' : 'UNKNOWN', sourceId: ctx.sourceId, sourceLocation: regRef, entryMode: data.entryMode, effectiveDate: data.effectiveDate } })
  }
  await saveRef(ctx, 'regulatory', externalId, created.id, hash)
  await requestReview(ctx.actor, { entityType: 'RegulatoryRecord', entityId: created.id, title: `Regulatory review: ${ing.displayName} (${jurisdiction})`, reviewType: 'REGULATORY' })
  return { outcome: check.state === 'CHANGED' ? 'UPDATED' : 'CREATED', entityId: created.id, externalKey: externalId, message: data.lastCheckedAt ? undefined : 'Never checked against source: shown as stale.' }
}

const fact: Handler = async (row, ctx, hash) => {
  const ing = await resolveIngredient(ctx, str(row.ingredient))
  if (!ing) return { outcome: 'QUARANTINED', message: `Unknown ingredient "${str(row.ingredient)}".` }
  const propertyType = str(row.property_type).toUpperCase() as PropertyType
  const value = str(row.value)
  if (!propertyType || !value) return { outcome: 'REJECTED', message: 'property_type and value are required.' }
  const externalId = str(row.external_id) || `${ing.id}:${propertyType}:${normalizeName(value)}:${str(row.unit)}:${str(row.source_location)}`
  const check = await checkRef(ctx, 'fact', externalId, hash)
  if (check.state === 'UNCHANGED') return { outcome: 'UNCHANGED', entityId: check.ref!.entityId, externalKey: externalId }
  const f = await createFact(ctx.actor, { ingredientId: ing.id, propertyType, value, unit: str(row.unit) || null, sourceId: ctx.sourceId, sourceLocation: str(row.source_location) || undefined, entryMode: (str(row.entry_mode) || 'IMPORTED') as EntryMode, testConditions: str(row.test_conditions) || undefined, medium: str(row.medium) || undefined, confidence: num(row.confidence) ?? undefined })
  await saveRef(ctx, 'fact', externalId, f.id, hash)
  return { outcome: f.qualityFlags.length ? 'WARNING' : 'CREATED', entityId: f.id, externalKey: externalId, message: f.qualityFlags.join(', ') || undefined }
}

export const HANDLERS: Record<string, Handler> = { ingredient, product, evidence, patent, regulatory, fact }
