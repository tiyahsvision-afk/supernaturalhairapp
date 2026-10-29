import { describe, expect, it } from 'vitest'
import { prisma } from '@/lib/db'
import { processBatch, processWithdrawal } from '@/lib/integration/hair-passport'
import { makeUser, uid } from './fixtures'

const CONTRACT = 'hp-ii/0.1.0-draft'
function rec(over: Record<string, unknown> = {}) {
  return {
    contractVersion: CONTRACT, recordType: 'PHENOTYPE_OBSERVATION', externalRecordId: `t-${uid()}`, revision: 1, participantRef: `hp-test-participant-${uid()}-${uid()}`,
    consent: { researchUse: true, healthDataUse: false, imageDerivedUse: false, modelTrainingUse: false, asOf: '2026-10-01', protocolVersion: 'test' },
    sourceType: 'SELF_REPORTED', observedAt: '2026-10-01', datePrecision: 'DAY', method: { code: 'hp-assessment-q' }, confidence: null, qualityFlags: [],
    deidentification: { protocolVersion: 'test', dateShifted: false, geoPrecision: 'country' },
    payload: { termCode: 'curl-geometry', termSystem: 'ii-hair-scalp', termSystemVersion: '0.1.0-draft', value: 'coily' },
    ...over,
  }
}

describe('Hair Passport integration contract (mock, unvalidated)', () => {
  const actor = async () => (await makeUser(['DATA_ADMIN'])).principal

  it('rejects unsupported contract versions', async () => {
    await expect(processBatch(await actor(), { contractVersion: 'hp-ii/9.9', records: [rec()] })).rejects.toThrow(/Unsupported contract/)
  })

  it('accepts a consented observation, maps it to the ontology and keeps it marked as mock', async () => {
    const r = rec()
    const out = await processBatch(await actor(), { contractVersion: CONTRACT, records: [r] })
    expect(out.isMock).toBe(true)
    expect(out.results[0].status).toBe('ACCEPTED')
    const obs = await prisma.phenotypeObservation.findFirstOrThrow({ where: { participant: { participantRef: r.participantRef } } })
    expect((await prisma.ontologyTerm.findUniqueOrThrow({ where: { id: obs.ontologyTermId! } })).code).toBe('curl-geometry')
    expect(obs.isMock).toBe(true)
    expect(obs.sourceType).toBe('SELF_REPORTED')
  })

  it('is idempotent per record revision', async () => {
    const r = rec()
    const a = await actor()
    await processBatch(a, { contractVersion: CONTRACT, records: [r] })
    const again = await processBatch(a, { contractVersion: CONTRACT, records: [r] })
    expect(again.results[0].status).toBe('DUPLICATE')
    const rev2 = await processBatch(a, { contractVersion: CONTRACT, records: [{ ...r, revision: 2 }] })
    expect(rev2.results[0].status).toBe('ACCEPTED')
  })

  it('rejects records containing direct identifiers and stores no payload', async () => {
    const r = rec({ payload: { termCode: 'curl-geometry', termSystem: 'ii-hair-scalp', termSystemVersion: '0.1.0-draft', value: 'coily', email: 'someone@example.com' } })
    const out = await processBatch(await actor(), { contractVersion: CONTRACT, records: [r] })
    expect(out.results[0].status).toBe('REJECTED')
    const stored = await prisma.integrationRecord.findFirstOrThrow({ where: { batchId: (await prisma.integrationBatch.findFirstOrThrow({ orderBy: { receivedAt: 'desc' } })).id } })
    expect(stored.rawPayload).toBeNull()
    expect(JSON.stringify(await prisma.integrationRecord.findMany({ where: { externalRecordId: { startsWith: r.externalRecordId } } }))).not.toContain('someone@example.com')
  })

  it('without research consent nothing is stored; without health consent sensitivity factors are refused', async () => {
    const a = await actor()
    const noResearch = rec({ consent: { researchUse: false, healthDataUse: false, imageDerivedUse: false, modelTrainingUse: false, asOf: '2026-10-01', protocolVersion: 't' } })
    expect((await processBatch(a, { contractVersion: CONTRACT, records: [noResearch] })).results[0].status).toBe('REJECTED')
    expect(await prisma.researchParticipant.count({ where: { participantRef: noResearch.participantRef } })).toBe(0)
    const sens = rec({ recordType: 'SENSITIVITY_FACTOR', payload: { category: 'FRAGRANCE_SENSITIVITY', present: true } })
    expect((await processBatch(a, { contractVersion: CONTRACT, records: [sens] })).results[0].status).toBe('REJECTED')
    expect(await prisma.sensitivityFactor.count({ where: { participant: { participantRef: sens.participantRef } } })).toBe(0)
  })

  it('strips health-related context from outcomes when health-data consent is absent', async () => {
    const r = rec({ recordType: 'OUTCOME_OBSERVATION', payload: { termCode: 'visible-flaking', termSystem: 'ii-hair-scalp', termSystemVersion: '0.1.0-draft', value: 'moderate', context: { season: 'autumn', medicationChange: 'yes' } } })
    const out = await processBatch(await actor(), { contractVersion: CONTRACT, records: [r] })
    expect(out.results[0].status).toBe('ACCEPTED')
    const o = await prisma.outcomeObservation.findFirstOrThrow({ where: { participant: { participantRef: r.participantRef } } })
    expect(o.context).toEqual({ season: 'autumn' })
  })

  it('quarantines unmapped terms and AI estimates without a model version; a new mapping row needs no migration', async () => {
    const a = await actor()
    const code = `newTerm${uid()}`
    const unmapped = rec({ payload: { termCode: code, termSystem: 'hp-assessment', termSystemVersion: '0.1', value: 'x' } })
    expect((await processBatch(a, { contractVersion: CONTRACT, records: [unmapped] })).results[0].status).toBe('QUARANTINED')
    const term = await prisma.ontologyTerm.findUniqueOrThrow({ where: { code: 'scalp-dryness' } })
    await prisma.taxonomyMapping.create({ data: { externalSystem: 'hair-passport', externalTaxonomy: 'hp-assessment', externalVersion: '0.1', externalCode: code, ontologyTermId: term.id, mappingVersion: 'test' } })
    expect((await processBatch(a, { contractVersion: CONTRACT, records: [{ ...unmapped, revision: 2 }] })).results[0].status).toBe('ACCEPTED')
    const ai = rec({ sourceType: 'AI_ESTIMATE', method: { code: 'hairfm-curl' } })
    expect((await processBatch(a, { contractVersion: CONTRACT, records: [ai] })).results[0].status).toBe('QUARANTINED')
  })

  it('withdrawal excludes the participant from future records and schedules deletion', async () => {
    const a = await actor()
    const r = rec()
    await processBatch(a, { contractVersion: CONTRACT, records: [r] })
    const w = await processWithdrawal(a, { participantRef: r.participantRef, scope: 'ALL' })
    expect(w.participantFound).toBe(true)
    expect(w.deletionScheduled).toBe(true)
    const p = await prisma.researchParticipant.findFirstOrThrow({ where: { participantRef: r.participantRef } })
    expect(p.withdrawnAt).not.toBeNull()
    expect(p.modelTrainingEligible).toBe(false)
    const later = await processBatch(a, { contractVersion: CONTRACT, records: [rec({ participantRef: r.participantRef })] })
    expect(later.results[0].status).toBe('REJECTED')
  })
})
