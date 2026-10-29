import { randomBytes } from 'node:crypto'
import { z } from 'zod'
import type { Prisma } from '@prisma/client'
import { prisma } from '../db'
import { audit } from '../audit'
import type { Principal } from '../permissions'
import { versionAt } from '../services/products'

// Implements integration contract hp-ii/0.1.0-draft (docs/hair-passport-integration-contract.md).
// NOT validated against a live Hair Passport system. All data received so far is mock data.

export const EXTERNAL_SYSTEM = 'hair-passport'
export const SUPPORTED_CONTRACTS = ['hp-ii/0.1.0-draft']
export const II_TERM_SYSTEM = 'ii-hair-scalp'

const SourceType = z.enum(['SELF_REPORTED', 'CLINICIAN_OBSERVED', 'PROFESSIONAL_OBSERVED', 'INSTRUMENT_MEASURED', 'IMAGE_DERIVED', 'AI_ESTIMATE', 'SYSTEM_DERIVED'])
const ExposureConfidence = z.enum(['EXACT_INTERNAL_FORMULA', 'MANUFACTURER_CONFIRMED_FORMULA', 'SUPPLIER_CONFIRMED_ACTIVE', 'STUDY_CONFIRMED_CONCENTRATION', 'ESTIMATED_RANGE', 'LABEL_CONFIRMED_PRESENCE', 'USER_REPORTED_PRODUCT', 'INFERRED', 'UNKNOWN'])

const Consent = z.object({ researchUse: z.boolean(), healthDataUse: z.boolean(), imageDerivedUse: z.boolean(), modelTrainingUse: z.boolean(), asOf: z.string(), protocolVersion: z.string() })

export const EnvelopeSchema = z.object({
  contractVersion: z.string(),
  recordType: z.enum(['PARTICIPANT', 'CONSENT', 'PHENOTYPE_OBSERVATION', 'EXPOSURE_EVENT', 'OUTCOME_OBSERVATION', 'SENSITIVITY_FACTOR']),
  externalRecordId: z.string().min(1).max(200),
  revision: z.number().int().min(1).default(1),
  participantRef: z.string().min(16).max(200),
  consent: Consent,
  sourceType: SourceType,
  observedAt: z.string(),
  datePrecision: z.enum(['DAY', 'WEEK', 'MONTH']).default('DAY'),
  method: z.object({ code: z.string(), version: z.string().optional(), description: z.string().optional() }),
  confidence: z.number().min(0).max(1).nullable(),
  qualityFlags: z.array(z.string()).default([]),
  deidentification: z.object({ protocolVersion: z.string(), dateShifted: z.boolean(), geoPrecision: z.string() }),
  payload: z.record(z.string(), z.unknown()),
})

const TermPayload = z.object({ termCode: z.string(), termSystem: z.string(), termSystemVersion: z.string(), value: z.unknown(), unit: z.string().optional(), scale: z.string().optional() })
const ExposurePayload = z.object({
  productRef: z.object({ system: z.enum(['hp', 'gtin', 'ii']), code: z.string() }).optional(),
  formulaVersionRef: z.string().optional(),
  exposureConfidence: ExposureConfidence,
  startDate: z.string(),
  endDate: z.string().optional(),
  frequency: z.object({ count: z.number(), per: z.string() }).optional(),
  applicationQuantity: z.object({ value: z.number(), unit: z.string() }).optional(),
  contactDuration: z.object({ value: z.number(), unit: z.string() }).optional(),
  rinseOffOrLeaveOn: z.enum(['RINSE_OFF', 'LEAVE_ON']).optional(),
  applicationSites: z.array(z.string()).default([]),
  coverage: z.string().optional(),
  adherence: z.object({ value: z.number(), method: z.string() }).optional(),
}).passthrough()
const SensitivityPayload = z.object({ category: z.string(), codeSystem: z.string().optional(), code: z.string().optional(), present: z.union([z.boolean(), z.literal('unknown')]) })

// Keys that indicate direct identifiers. Any occurrence anywhere in the record rejects it.
const DIRECT_ID_KEYS = /^(e-?mail|name|first_?name|last_?name|full_?name|phone|address|street|zip|postcode|dob|date_?of_?birth|birth_?date|account_?id|user_?id|device_?id|ip|image_?url|photo_?url|ssn)$/i
const HEALTH_CONTEXT_KEYS = /medication|pregnan|postpartum|hormon|diagnos|medical|condition/i

export function findDirectIdentifiers(v: unknown, path = ''): string[] {
  if (!v || typeof v !== 'object') return []
  const out: string[] = []
  for (const [k, val] of Object.entries(v as Record<string, unknown>)) {
    if (DIRECT_ID_KEYS.test(k)) out.push(`${path}${k}`)
    out.push(...findDirectIdentifiers(val, `${path}${k}.`))
  }
  return out
}

export interface RecordResult { externalRecordId: string; recordType?: string; status: 'ACCEPTED' | 'QUARANTINED' | 'REJECTED' | 'DUPLICATE'; messages: string[] }

async function participantFor(ref: string, isMock: boolean, consent: z.infer<typeof Consent>) {
  const existing = await prisma.researchParticipant.findUnique({ where: { externalSystem_participantRef: { externalSystem: EXTERNAL_SYSTEM, participantRef: ref } }, include: { consents: { orderBy: { asOf: 'desc' }, take: 1 } } })
  const p = existing ?? await prisma.researchParticipant.create({ data: { researchId: `RP-${randomBytes(5).toString('hex').toUpperCase()}`, externalSystem: EXTERNAL_SYSTEM, participantRef: ref, isMock } })
  const latest = existing?.consents[0]
  const changed = !latest || latest.researchUse !== consent.researchUse || latest.healthDataUse !== consent.healthDataUse || latest.imageDerivedUse !== consent.imageDerivedUse || latest.modelTrainingUse !== consent.modelTrainingUse || latest.protocolVersion !== consent.protocolVersion
  if (changed && (!latest || new Date(consent.asOf) >= latest.asOf)) {
    await prisma.consentSnapshot.create({ data: { participantId: p.id, ...consent, asOf: new Date(consent.asOf) } })
    await prisma.researchParticipant.update({ where: { id: p.id }, data: { modelTrainingEligible: consent.modelTrainingUse && !p.withdrawnAt } })
  }
  return p
}

async function mapTerm(termSystem: string, version: string, code: string) {
  if (termSystem === II_TERM_SYSTEM) return prisma.ontologyTerm.findUnique({ where: { code } })
  const m = await prisma.taxonomyMapping.findUnique({ where: { externalSystem_externalTaxonomy_externalVersion_externalCode: { externalSystem: EXTERNAL_SYSTEM, externalTaxonomy: termSystem, externalVersion: version, externalCode: code } }, include: { ontologyTerm: true } })
  return m && m.status === 'ACTIVE' ? m.ontologyTerm : null
}

async function resolveProduct(ref?: { system: string; code: string }) {
  if (!ref) return null
  if (ref.system === 'ii') return prisma.product.findUnique({ where: { id: ref.code.replace(/^ii:product:/, '') } }).catch(() => null)
  if (ref.system === 'gtin') return prisma.product.findFirst({ where: { barcode: ref.code.replace(/^gtin:/, '') } })
  return null
}

/** Processes a batch. Raw payloads are stored before normalization; consent-rejected records keep no payload. */
export async function processBatch(actor: Principal, body: { contractVersion?: string; isMock?: boolean; records?: unknown[] }) {
  const contractVersion = body.contractVersion ?? ''
  if (!SUPPORTED_CONTRACTS.includes(contractVersion)) throw new Error(`Unsupported contract version "${contractVersion}". Supported: ${SUPPORTED_CONTRACTS.join(', ')}`)
  if (!Array.isArray(body.records) || body.records.length === 0) throw new Error('records must be a non-empty array.')
  if (body.records.length > 5000) throw new Error('Maximum 5000 records per batch.')
  const isMock = body.isMock !== false
  const batch = await prisma.integrationBatch.create({ data: { externalSystem: EXTERNAL_SYSTEM, contractVersion, organizationId: actor.organizationId, apiKeyId: actor.kind === 'API_KEY' ? actor.id : null, isMock, recordCount: body.records.length } })
  const results: RecordResult[] = []
  for (const raw of body.records) results.push(await processRecord(batch.id, raw, isMock))
  const count = (s: string) => results.filter((r) => r.status === s).length
  await prisma.integrationBatch.update({ where: { id: batch.id }, data: { acceptedCount: count('ACCEPTED'), quarantinedCount: count('QUARANTINED'), rejectedCount: count('REJECTED'), duplicateCount: count('DUPLICATE') } })
  await audit(actor, { action: 'integration.batch', entityType: 'IntegrationBatch', entityId: batch.id, after: { records: results.length, accepted: count('ACCEPTED'), quarantined: count('QUARANTINED'), rejected: count('REJECTED'), isMock } })
  return { batchId: batch.id, isMock, results }
}

async function logRecord(batchId: string, rec: { recordType: string; externalRecordId: string; revision: number; participantRef?: string; rawPayload: unknown; status: RecordResult['status']; messages: string[]; isMock: boolean; normalizedEntityType?: string; normalizedEntityId?: string }) {
  return prisma.integrationRecord.create({ data: { batchId, externalSystem: EXTERNAL_SYSTEM, recordType: rec.recordType, externalRecordId: rec.externalRecordId, revision: rec.revision, participantRef: rec.participantRef, rawPayload: rec.rawPayload === null ? undefined : (rec.rawPayload as Prisma.InputJsonValue), status: rec.status, messages: rec.messages, isMock: rec.isMock, normalizedEntityType: rec.normalizedEntityType, normalizedEntityId: rec.normalizedEntityId, mappingVersion: 'mapping-0.1.0' } })
}

async function processRecord(batchId: string, raw: unknown, isMock: boolean): Promise<RecordResult> {
  const extId = typeof raw === 'object' && raw && 'externalRecordId' in raw ? String((raw as Record<string, unknown>).externalRecordId) : 'unknown'
  const ids = findDirectIdentifiers(raw)
  if (ids.length) {
    // Do not store the payload: it contains direct identifiers.
    await logRecord(batchId, { recordType: 'UNKNOWN', externalRecordId: `${extId}#rejected-${Date.now()}`, revision: 1, rawPayload: null, status: 'REJECTED', messages: [`Direct identifiers are not accepted: ${ids.join(', ')}`], isMock })
    return { externalRecordId: extId, status: 'REJECTED', messages: [`Direct identifiers are not accepted (${ids.length} field(s)). Payload discarded.`] }
  }
  const parsed = EnvelopeSchema.safeParse(raw)
  if (!parsed.success) return { externalRecordId: extId, status: 'REJECTED', messages: parsed.error.issues.slice(0, 5).map((i) => `${i.path.join('.')}: ${i.message}`) }
  const r = parsed.data
  const dup = await prisma.integrationRecord.findUnique({ where: { externalSystem_recordType_externalRecordId_revision: { externalSystem: EXTERNAL_SYSTEM, recordType: r.recordType, externalRecordId: r.externalRecordId, revision: r.revision } } })
  if (dup) return { externalRecordId: r.externalRecordId, recordType: r.recordType, status: 'DUPLICATE', messages: ['Same record and revision already received.'] }
  const base = { recordType: r.recordType, externalRecordId: r.externalRecordId, revision: r.revision, participantRef: r.participantRef, isMock }
  if (!r.consent.researchUse) {
    await logRecord(batchId, { ...base, participantRef: undefined, rawPayload: null, status: 'REJECTED', messages: ['No research-use consent; payload not stored.'] })
    return { externalRecordId: r.externalRecordId, recordType: r.recordType, status: 'REJECTED', messages: ['No research-use consent; payload not stored.'] }
  }
  if (r.recordType === 'SENSITIVITY_FACTOR' && !r.consent.healthDataUse) {
    await logRecord(batchId, { ...base, rawPayload: null, status: 'REJECTED', messages: ['Health-data consent not given; sensitivity factor not stored.'] })
    return { externalRecordId: r.externalRecordId, recordType: r.recordType, status: 'REJECTED', messages: ['Health-data consent not given; sensitivity factor not stored.'] }
  }
  const participant = await participantFor(r.participantRef, isMock, r.consent)
  if (participant.withdrawnAt) {
    await logRecord(batchId, { ...base, rawPayload: null, status: 'REJECTED', messages: ['Participant has withdrawn.'] })
    return { externalRecordId: r.externalRecordId, recordType: r.recordType, status: 'REJECTED', messages: ['Participant has withdrawn.'] }
  }
  const messages: string[] = []
  if (r.sourceType === 'AI_ESTIMATE' && !r.method.version) {
    await logRecord(batchId, { ...base, rawPayload: r, status: 'QUARANTINED', messages: ['AI_ESTIMATE requires method.version (model version).'] })
    await prisma.quarantineItem.create({ data: { queue: 'LOW_CONFIDENCE_AI', entityType: 'IntegrationRecord', payload: { externalRecordId: r.externalRecordId }, reason: 'AI estimate without model version.' } })
    return { externalRecordId: r.externalRecordId, recordType: r.recordType, status: 'QUARANTINED', messages: ['AI_ESTIMATE requires method.version (model version).'] }
  }
  const common = { participantId: participant.id, sourceType: r.sourceType, isMock }
  if (r.recordType === 'PHENOTYPE_OBSERVATION' || r.recordType === 'OUTCOME_OBSERVATION') {
    const tp = TermPayload.safeParse(r.payload)
    if (!tp.success) return { externalRecordId: r.externalRecordId, recordType: r.recordType, status: 'REJECTED', messages: ['payload must include termCode, termSystem, termSystemVersion and value.'] }
    const term = await mapTerm(tp.data.termSystem, tp.data.termSystemVersion, tp.data.termCode)
    if (!term) {
      const rec = await logRecord(batchId, { ...base, rawPayload: r, status: 'QUARANTINED', messages: [`Unmapped term ${tp.data.termSystem}@${tp.data.termSystemVersion}:${tp.data.termCode}`] })
      await prisma.quarantineItem.create({ data: { queue: 'UNMAPPED_TERM', entityType: 'IntegrationRecord', entityId: rec.id, payload: { termSystem: tp.data.termSystem, version: tp.data.termSystemVersion, code: tp.data.termCode }, reason: 'Add a TaxonomyMapping row, then reprocess. No migration required.' } })
      return { externalRecordId: r.externalRecordId, recordType: r.recordType, status: 'QUARANTINED', messages: ['Unmapped term; stored raw and quarantined.'] }
    }
    const obs = {
      ...common, ontologyTermId: term.id, externalTermSystem: tp.data.termSystem, externalTermCode: tp.data.termCode, value: tp.data.value as Prisma.InputJsonValue, unit: tp.data.unit,
      methodCode: r.method.code, methodVersion: r.method.version, modelVersion: r.sourceType === 'AI_ESTIMATE' ? r.method.version : undefined, confidence: r.confidence, qualityFlags: r.qualityFlags,
      observedAt: new Date(r.observedAt), datePrecision: r.datePrecision,
    }
    const rec = await logRecord(batchId, { ...base, rawPayload: r, status: 'ACCEPTED', messages })
    if (r.recordType === 'PHENOTYPE_OBSERVATION') {
      const row = await prisma.phenotypeObservation.create({ data: { ...obs, integrationRecordId: rec.id } })
      await prisma.integrationRecord.update({ where: { id: rec.id }, data: { normalizedEntityType: 'PhenotypeObservation', normalizedEntityId: row.id } })
    } else {
      const p = r.payload as Record<string, unknown>
      let context = (p.context ?? null) as Record<string, unknown> | null
      if (context && !r.consent.healthDataUse) {
        const stripped = Object.keys(context).filter((k) => HEALTH_CONTEXT_KEYS.test(k))
        if (stripped.length) { context = Object.fromEntries(Object.entries(context).filter(([k]) => !HEALTH_CONTEXT_KEYS.test(k))); messages.push(`Health-related context removed (no health-data consent): ${stripped.join(', ')}`) }
      }
      const row = await prisma.outcomeObservation.create({ data: { ...obs, integrationRecordId: rec.id, baselineRecordRef: p.baselineRecordRef as string | undefined, followUpDays: p.followUpDays as number | undefined, exposureEventRefs: (p.exposureEventRefs as string[]) ?? [], concurrentChanges: (p.concurrentChanges as string[]) ?? [], context: (context ?? undefined) as Prisma.InputJsonValue | undefined } })
      await prisma.integrationRecord.update({ where: { id: rec.id }, data: { normalizedEntityType: 'OutcomeObservation', normalizedEntityId: row.id, messages } })
    }
    return { externalRecordId: r.externalRecordId, recordType: r.recordType, status: 'ACCEPTED', messages }
  }
  if (r.recordType === 'EXPOSURE_EVENT') {
    const ep = ExposurePayload.safeParse(r.payload)
    if (!ep.success) return { externalRecordId: r.externalRecordId, recordType: r.recordType, status: 'REJECTED', messages: ep.error.issues.slice(0, 3).map((i) => `payload.${i.path.join('.')}: ${i.message}`) }
    const product = await resolveProduct(ep.data.productRef)
    const start = new Date(ep.data.startDate)
    const pv = product ? await versionAt(product.id, start) : null
    if (ep.data.productRef && !product) messages.push('Product reference not resolved; stored as raw reference.')
    if (product && !pv) messages.push('No product ingredient-list version valid at the exposure start date.')
    let formulaVersionId: string | undefined
    if (ep.data.formulaVersionRef) {
      const fv = await prisma.formulaVersion.findUnique({ where: { id: ep.data.formulaVersionRef.replace(/^ii:formula-version:/, '') } }).catch(() => null)
      if (fv) formulaVersionId = fv.id
      else messages.push('Formula version reference not resolved.')
    }
    if (ep.data.exposureConfidence === 'EXACT_INTERNAL_FORMULA' && !formulaVersionId) messages.push('EXACT_INTERNAL_FORMULA claimed without a resolvable formula version; concentration will not be computed.')
    const rec = await logRecord(batchId, { ...base, rawPayload: r, status: 'ACCEPTED', messages })
    const row = await prisma.exposureEvent.create({
      data: {
        ...common, integrationRecordId: rec.id, externalRecordId: r.externalRecordId, productId: product?.id, productVersionId: pv?.id, formulaVersionId, productRefRaw: ep.data.productRef ? `${ep.data.productRef.system}:${ep.data.productRef.code}` : null,
        exposureConfidence: ep.data.exposureConfidence, startDate: start, endDate: ep.data.endDate ? new Date(ep.data.endDate) : null, frequency: ep.data.frequency, applicationQuantity: ep.data.applicationQuantity,
        contactDuration: ep.data.contactDuration, applicationType: ep.data.rinseOffOrLeaveOn ?? 'UNKNOWN', applicationSites: ep.data.applicationSites, coverage: ep.data.coverage, adherence: ep.data.adherence,
        details: r.payload as Prisma.InputJsonValue,
      },
    })
    await prisma.integrationRecord.update({ where: { id: rec.id }, data: { normalizedEntityType: 'ExposureEvent', normalizedEntityId: row.id, messages } })
    return { externalRecordId: r.externalRecordId, recordType: r.recordType, status: 'ACCEPTED', messages }
  }
  if (r.recordType === 'SENSITIVITY_FACTOR') {
    const sp = SensitivityPayload.safeParse(r.payload)
    if (!sp.success) return { externalRecordId: r.externalRecordId, recordType: r.recordType, status: 'REJECTED', messages: ['Invalid sensitivity payload.'] }
    const rec = await logRecord(batchId, { ...base, rawPayload: r, status: 'ACCEPTED', messages })
    const row = await prisma.sensitivityFactor.create({ data: { participantId: participant.id, integrationRecordId: rec.id, category: sp.data.category, codeSystem: sp.data.codeSystem, code: sp.data.code, present: String(sp.data.present), isMock } })
    await prisma.integrationRecord.update({ where: { id: rec.id }, data: { normalizedEntityType: 'SensitivityFactor', normalizedEntityId: row.id } })
    return { externalRecordId: r.externalRecordId, recordType: r.recordType, status: 'ACCEPTED', messages }
  }
  if (r.recordType === 'PARTICIPANT') {
    const p = r.payload as { ageBand?: string; regionCoarse?: string }
    await prisma.researchParticipant.update({ where: { id: participant.id }, data: { ageBand: p.ageBand, regionCoarse: p.regionCoarse } })
  }
  await logRecord(batchId, { ...base, rawPayload: r, status: 'ACCEPTED', messages, normalizedEntityType: 'ResearchParticipant', normalizedEntityId: participant.id })
  return { externalRecordId: r.externalRecordId, recordType: r.recordType, status: 'ACCEPTED', messages }
}

/**
 * Withdrawal: excludes the participant from all future cohorts/exports, revokes model-training eligibility and schedules
 * deletion (unless a legal hold applies). Completed analyses are not silently altered; Phase 1 has no analyses yet.
 */
export async function processWithdrawal(actor: Principal, body: { participantRef?: string; effectiveAt?: string; scope?: string; isMock?: boolean }) {
  if (!body.participantRef) throw new Error('participantRef is required.')
  const scope = body.scope ?? 'ALL'
  if (!['ALL', 'MODEL_TRAINING', 'HEALTH_DATA'].includes(scope)) throw new Error('scope must be ALL, MODEL_TRAINING or HEALTH_DATA.')
  const p = await prisma.researchParticipant.findUnique({ where: { externalSystem_participantRef: { externalSystem: EXTERNAL_SYSTEM, participantRef: body.participantRef } } })
  const effectiveAt = body.effectiveAt ? new Date(body.effectiveAt) : new Date()
  const notice = await prisma.withdrawalNotice.create({ data: { externalSystem: EXTERNAL_SYSTEM, participantRef: body.participantRef, participantId: p?.id, scope, effectiveAt, isMock: body.isMock !== false, affectedAnalyses: [], notes: p ? undefined : 'Participant not found; nothing stored for this reference.' } })
  if (p) {
    if (scope === 'ALL') await prisma.researchParticipant.update({ where: { id: p.id }, data: { withdrawnAt: effectiveAt, modelTrainingEligible: false, deletionScheduledAt: p.legalHold ? null : new Date(Date.now() + 30 * 86400_000) } })
    if (scope === 'MODEL_TRAINING') await prisma.researchParticipant.update({ where: { id: p.id }, data: { modelTrainingEligible: false } })
    if (scope === 'HEALTH_DATA') await prisma.sensitivityFactor.deleteMany({ where: { participantId: p.id } })
  }
  await prisma.withdrawalNotice.update({ where: { id: notice.id }, data: { processedAt: new Date() } })
  await audit(actor, { action: 'integration.withdrawal', entityType: 'WithdrawalNotice', entityId: notice.id, after: { scope, participantFound: Boolean(p) } })
  return { noticeId: notice.id, participantFound: Boolean(p), scope, deletionScheduled: Boolean(p && scope === 'ALL' && !p.legalHold), affectedAnalyses: [] }
}
