import Link from 'next/link'
import { notFound } from 'next/navigation'
import { prisma } from '@/lib/db'
import { allowed, requireUser } from '@/lib/auth/next'
import { can } from '@/lib/permissions'
import { CRITERIA, LEVELS, RUBRIC_VERSION } from '@/lib/evidence-rubric'
import { Badge, Card, DISCLAIMERS, EntryModeBadge, KeyValue, Notice, PageHeader, PermissionDenied, ReviewBadge, Button } from '@/components/ui'
import { gradeEvidenceAction } from '../actions'

export const dynamic = 'force-dynamic'

export default async function EvidenceDetail({ params }: { params: Promise<{ id: string }> }) {
  const s = await requireUser()
  if (!(await allowed(s, 'evidence:read', '/evidence/[id]'))) return <PermissionDenied permission="evidence:read" />
  const { id } = await params
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound()
  const e = await prisma.evidence.findUnique({ where: { id }, include: { links: { include: { ingredient: true, ontologyTerm: true } } } })
  if (!e) notFound()
  const source = await prisma.source.findUnique({ where: { id: e.sourceId } })
  const scores = (e.qualityPreliminary ?? {}) as Record<string, number | null>
  return (
    <>
      <PageHeader eyebrow={`${e.studyType.replace(/_/g, ' ').toLowerCase()}${e.evidenceLevel ? ` · level ${e.evidenceLevel}: ${LEVELS[e.evidenceLevel]}` : ''}`} title={e.title} actions={<><EntryModeBadge mode={e.entryMode} /><ReviewBadge status={e.reviewStatus} /></>} />
      {e.entryMode === 'AI_EXTRACTED' && <Notice kind="warn" title={DISCLAIMERS.aiDraft}>Study type, evidence level and ingredient/outcome links were proposed from the title and index snippet only. Full text has not been extracted. These are not approved evidence until a qualified reviewer approves them.</Notice>}
      {e.medicalContext && <Notice kind="warn" title="Medical / drug context">This study concerns a medical condition or drug comparator. It cannot support a cosmetic claim and must not be converted into one.</Notice>}
      <div className="grid gap-4 lg:grid-cols-3">
        <Card title="Citation & provenance" className="lg:col-span-2">
          <KeyValue items={[['PMID', e.pmid ? <a key="p" href={`https://pubmed.ncbi.nlm.nih.gov/${e.pmid}/`} target="_blank" rel="noreferrer">{e.pmid}</a> : null], ['DOI', e.doi ? <a key="d" href={`https://doi.org/${e.doi}`} target="_blank" rel="noreferrer">{e.doi}</a> : null], ['PMCID', e.pmcid], ['Journal', e.journal], ['Published', e.publicationDate?.toISOString().slice(0, 10)], ['Source', source ? <Link key="s" href={`/sources/${source.id}`}>{source.name}</Link> : null], ['Extraction status', e.extractionStatus.replace(/_/g, ' ').toLowerCase()], ['Full text available', e.fullTextAvailable === null ? 'unknown' : e.fullTextAvailable ? 'yes' : 'no']]} />
        </Card>
        <Card title="Study details">
          <KeyValue items={[['Population', e.population], ['Sample size', e.sampleSize], ['Comparator', e.comparator], ['Duration', e.duration], ['Concentration', e.concentrationText], ['Measurement', e.measurementMethod], ['Statistics', e.statisticalResult], ['Funding', e.fundingSource], ['COI', e.coiInfo], ['Textured hair', e.texturedHairRelevant === null ? 'unknown' : e.texturedHairRelevant ? 'yes' : 'no']]} />
        </Card>
        <Card title="Interpretation layers (kept separate)" className="lg:col-span-3">
          <div className="grid gap-4 md:grid-cols-2">
            <div><div className="text-xs font-semibold uppercase text-ink-3">Source conclusion</div><p className="text-sm">{e.sourceConclusion ?? <span className="text-ink-3">Not extracted.</span>}</p></div>
            <div><div className="text-xs font-semibold uppercase text-ink-3">AI-generated summary <Badge tone="warn">AI draft</Badge></div><p className="text-sm">{e.aiSummary ?? <span className="text-ink-3">None. (The assistant arrives in Phase 4.)</span>}</p></div>
            <div><div className="text-xs font-semibold uppercase text-ink-3">Human-reviewed interpretation</div><p className="text-sm">{e.reviewedInterpretation ?? <span className="text-ink-3">Not yet reviewed.</span>}</p></div>
            <div><div className="text-xs font-semibold uppercase text-ink-3">Limitations</div><p className="text-sm">{e.limitations ?? <span className="text-ink-3">Not recorded.</span>}</p></div>
          </div>
        </Card>
        <Card title="Linked ingredients and outcomes" className="lg:col-span-3">
          <ul className="space-y-1 text-sm">{e.links.map((l) => <li key={l.id}><Badge>{l.role.toLowerCase()}</Badge> {l.ingredient ? <Link href={`/ingredients/${l.ingredientId}`}>{l.ingredient.displayName}</Link> : l.ontologyTerm?.label} <span className="text-xs text-ink-3">direction: {l.direction.toLowerCase()} · <EntryModeBadge mode={l.entryMode} /></span></li>)}</ul>
        </Card>
        <Card title={`Quality grading (${RUBRIC_VERSION})`} className="lg:col-span-3">
          <p className="mb-3 text-sm text-ink-2">Preliminary: <strong>{e.qualityPreliminaryCategory.replace(/_/g, ' ').toLowerCase()}</strong> · Reviewer grade: <strong>{e.qualityReviewerCategory.replace(/_/g, ' ').toLowerCase()}</strong>{e.qualityAdjustmentReason && <> · adjustment: {e.qualityAdjustmentReason}</>}</p>
          {can(s.principal, 'evidence:approve') ? (
            <form action={gradeEvidenceAction} className="space-y-3">
              <input type="hidden" name="id" value={e.id} />
              <div className="grid gap-2 md:grid-cols-2">{CRITERIA.map((c) => (
                <label key={c.key} className="flex items-start justify-between gap-2 rounded-lg border border-line p-2 text-sm"><span><span className="font-medium">{c.label}</span><span className="block text-xs text-ink-3">{c.guidance}</span></span>
                  <select name={`c_${c.key}`} defaultValue={scores[c.key] === undefined || scores[c.key] === null ? '' : String(scores[c.key])} className="w-28"><option value="">N/A</option><option value="0">0 weak</option><option value="1">1 partial</option><option value="2">2 strong</option></select></label>
              ))}</div>
              <div className="grid gap-2 sm:grid-cols-3">
                <select name="final" defaultValue=""><option value="">Accept preliminary grade</option>{['VERY_LOW', 'LOW', 'MODERATE', 'HIGH'].map((q) => <option key={q} value={q}>{q.replace('_', ' ').toLowerCase()}</option>)}</select>
                <input name="reason" placeholder="Adjustment reason (required if changed)" className="sm:col-span-2" />
                <textarea name="interpretation" rows={2} placeholder="Human-reviewed interpretation" className="sm:col-span-3" defaultValue={e.reviewedInterpretation ?? ''} />
              </div>
              <Button>Save grade</Button>
              <p className="text-xs text-ink-3">Approving the record itself happens in the Review Queue. Grades never derive from study type alone.</p>
            </form>
          ) : <p className="text-sm text-ink-3">Grading requires the evidence:approve permission.</p>}
        </Card>
      </div>
    </>
  )
}
