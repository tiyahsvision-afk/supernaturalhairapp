import Link from 'next/link'
import { prisma } from '@/lib/db'
import { allowed, requireUser } from '@/lib/auth/next'
import { can } from '@/lib/permissions'
import { Badge, Card, DISCLAIMERS, Notice, PageHeader, PermissionDenied, TableWrap, Tabs, Button } from '@/components/ui'
import { addMappingAction } from './actions'

export const dynamic = 'force-dynamic'

export default async function Integrations({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const s = await requireUser()
  if (!(await allowed(s, 'integration:manage', '/integrations'))) return <PermissionDenied permission="integration:manage" />
  const { tab = 'batches' } = await searchParams
  const participantLevel = can(s.principal, 'outcome:participant:read')
  const [batches, records, participants, mappings, withdrawals, terms] = await Promise.all([
    prisma.integrationBatch.findMany({ orderBy: { receivedAt: 'desc' }, take: 20 }),
    prisma.integrationRecord.findMany({ orderBy: { createdAt: 'desc' }, take: 100 }),
    prisma.researchParticipant.findMany({ include: { consents: { orderBy: { asOf: 'desc' }, take: 1 }, _count: { select: { phenotypes: true, exposures: true, outcomes: true, sensitivities: true } } } }),
    prisma.taxonomyMapping.findMany({ include: { ontologyTerm: true }, orderBy: { externalCode: 'asc' } }),
    prisma.withdrawalNotice.findMany({ orderBy: { receivedAt: 'desc' } }),
    prisma.ontologyTerm.findMany({ orderBy: { code: 'asc' } }),
  ])
  return (
    <>
      <PageHeader eyebrow="Contract hp-ii/0.1.0-draft" title="Hair Passport integration" subtitle="Inbound, de-identified, consent-filtered. Not validated and not live — all data below is mock data." actions={<Badge tone="warn">MOCK ONLY</Badge>} />
      <Notice kind="warn" title="Not a live connection">No Hair Passport system has sent data. These records were generated from seed/data/mock-hair-passport-batch.json to exercise the contract. {DISCLAIMERS.observational} Model-derived observations (HairFM) are labelled AI estimates and support research hypotheses only.</Notice>
      <Tabs active={tab} base="/integrations" tabs={[{ key: 'batches', label: 'Batches & records' }, { key: 'participants', label: 'Participants & consent' }, { key: 'mappings', label: 'Taxonomy mappings', count: mappings.length }, { key: 'withdrawals', label: 'Withdrawals', count: withdrawals.length }, { key: 'contract', label: 'Contract' }]} />
      {tab === 'batches' && (
        <>
          <TableWrap><table><thead><tr><th>Batch</th><th>Received</th><th>Mock</th><th className="text-right">Records</th><th className="text-right">Accepted</th><th className="text-right">Quarantined</th><th className="text-right">Rejected</th><th className="text-right">Duplicate</th></tr></thead><tbody>
            {batches.map((b) => <tr key={b.id}><td className="mono text-xs">{b.id.slice(0, 8)}</td><td className="text-xs">{b.receivedAt.toISOString().slice(0, 16).replace('T', ' ')}</td><td>{b.isMock ? <Badge tone="warn">mock</Badge> : 'no'}</td>{[b.recordCount, b.acceptedCount, b.quarantinedCount, b.rejectedCount, b.duplicateCount].map((c, i) => <td key={i} className="text-right tabular-nums">{c}</td>)}</tr>)}
          </tbody></table></TableWrap>
          <h2 className="mb-2 mt-6 text-lg">Records</h2>
          <TableWrap><table><thead><tr><th>Type</th><th>External id</th><th>Status</th><th>Messages</th><th>Normalized to</th></tr></thead><tbody>
            {records.map((r) => <tr key={r.id}><td className="text-xs">{r.recordType}</td><td className="mono text-xs">{r.externalRecordId.slice(0, 32)}</td><td><Badge tone={r.status === 'ACCEPTED' ? 'good' : r.status === 'REJECTED' ? 'bad' : 'warn'}>{r.status.toLowerCase()}</Badge></td><td className="text-xs">{r.messages.join(' · ')}{r.rawPayload === null && <div className="text-ink-3">payload not stored</div>}</td><td className="text-xs">{r.normalizedEntityType ?? '—'}</td></tr>)}
          </tbody></table></TableWrap>
        </>
      )}
      {tab === 'participants' && (participantLevel ? (
        <TableWrap><table><thead><tr><th>Research ID</th><th>Research</th><th>Health data</th><th>Images</th><th>Model training</th><th className="text-right">Phenotypes</th><th className="text-right">Exposures</th><th className="text-right">Outcomes</th><th className="text-right">Sensitivity</th><th>Status</th></tr></thead><tbody>
          {participants.map((p) => { const c = p.consents[0]; const b = (v?: boolean) => <Badge tone={v ? 'good' : 'neutral'}>{v ? 'yes' : 'no'}</Badge>; return (
            <tr key={p.id}><td className="mono text-xs">{p.researchId} {p.isMock && <Badge tone="warn">mock</Badge>}</td><td>{b(c?.researchUse)}</td><td>{b(c?.healthDataUse)}</td><td>{b(c?.imageDerivedUse)}</td><td>{b(c?.modelTrainingUse)}</td>{[p._count.phenotypes, p._count.exposures, p._count.outcomes, p._count.sensitivities].map((n, i) => <td key={i} className="text-right">{n}</td>)}<td className="text-xs">{p.withdrawnAt ? `withdrawn ${p.withdrawnAt.toISOString().slice(0, 10)}` : 'active'}</td></tr>) })}
        </tbody></table></TableWrap>
      ) : <Notice kind="warn">Participant-level views require the outcome:participant:read permission. Aggregate counts: {participants.length} participants.</Notice>)}
      {tab === 'mappings' && (
        <>
          <TableWrap><table><thead><tr><th>HP taxonomy</th><th>Version</th><th>HP code</th><th>Maps to (II ontology)</th><th>Mapping version</th></tr></thead><tbody>
            {mappings.map((m) => <tr key={m.id}><td>{m.externalTaxonomy}</td><td>{m.externalVersion}</td><td className="mono">{m.externalCode}</td><td>{m.ontologyTerm.label} <span className="mono text-xs text-ink-3">{m.ontologyTerm.code}</span></td><td className="text-xs">{m.mappingVersion}</td></tr>)}
          </tbody></table></TableWrap>
          <Card title="Add mapping (no migration needed)" className="mt-4">
            <form action={addMappingAction} className="grid gap-2 sm:grid-cols-5"><input name="taxonomy" placeholder="hp-assessment" required /><input name="version" placeholder="0.1" required /><input name="code" placeholder="HP code" required /><select name="termCode">{terms.map((t) => <option key={t.code} value={t.code}>{t.label}</option>)}</select><Button variant="secondary">Add</Button></form>
          </Card>
        </>
      )}
      {tab === 'withdrawals' && (withdrawals.length === 0 ? <p className="text-sm text-ink-3">No withdrawal notices received.</p> : <ul className="text-sm">{withdrawals.map((w) => <li key={w.id}>{w.scope} · effective {w.effectiveAt.toISOString().slice(0, 10)} · {w.participantId ? 'participant found' : 'not found'} {w.isMock && <Badge tone="warn">mock</Badge>}</li>)}</ul>)}
      {tab === 'contract' && <Card title="Integration contract"><p className="text-sm">The full contract is versioned in the repository at <code>intelligence/docs/hair-passport-integration-contract.md</code>. Endpoints: <code>POST /api/v1/integrations/hair-passport/batches</code> and <code>POST /api/v1/integrations/hair-passport/withdrawals</code> (API key with scope <code>integration:manage</code>). See <Link href="/api-docs">API</Link>.</p></Card>}
    </>
  )
}
