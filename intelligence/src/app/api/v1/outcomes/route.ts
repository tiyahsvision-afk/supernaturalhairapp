import { prisma } from '@/lib/db'
import { route, json, pageParams, paginate } from '@/lib/api/http'

/**
 * Consent-eligible, de-identified outcome observations. Excludes withdrawn participants and participants whose latest
 * consent snapshot does not permit research use. Mock data is excluded unless includeMock=true.
 */
export const GET = route('outcome:participant:read', async (ctx) => {
  const { limit, cursor, url } = pageParams(ctx.req)
  const includeMock = url.searchParams.get('includeMock') === 'true'
  const participants = await prisma.researchParticipant.findMany({
    where: { withdrawnAt: null, ...(includeMock ? {} : { isMock: false }) },
    select: { id: true, researchId: true, consents: { orderBy: { asOf: 'desc' }, take: 1, select: { researchUse: true } } },
  })
  const eligible = participants.filter((p) => p.consents[0]?.researchUse)
  const researchIds = new Map(eligible.map((p) => [p.id, p.researchId]))
  const rows = await prisma.outcomeObservation.findMany({
    where: { participantId: { in: [...researchIds.keys()] }, ...(includeMock ? {} : { isMock: false }) },
    orderBy: { id: 'asc' }, take: limit + 1, ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
  })
  const page = paginate(rows, limit)
  const terms = new Map((await prisma.ontologyTerm.findMany({ where: { id: { in: page.data.flatMap((o) => (o.ontologyTermId ? [o.ontologyTermId] : [])) } }, select: { id: true, code: true, label: true } })).map((t) => [t.id, { code: t.code, label: t.label }]))
  return json({
    ...page,
    data: page.data.map((o) => ({
      id: o.id, researchId: researchIds.get(o.participantId), term: o.ontologyTermId ? terms.get(o.ontologyTermId) ?? null : null, externalTerm: `${o.externalTermSystem}:${o.externalTermCode}`, value: o.value, unit: o.unit,
      sourceType: o.sourceType, method: o.methodCode, methodVersion: o.methodVersion, modelVersion: o.modelVersion, confidence: o.confidence, qualityFlags: o.qualityFlags,
      observedAt: o.observedAt, datePrecision: o.datePrecision, followUpDays: o.followUpDays, exposureEventRefs: o.exposureEventRefs, concurrentChanges: o.concurrentChanges, isMock: o.isMock,
    })),
    excludedParticipants: participants.length - eligible.length,
    notice: 'Observational signal — does not establish causation. Observation sources (user-reported, clinician, instrument, AI-estimated) are not interchangeable.',
  })
})
