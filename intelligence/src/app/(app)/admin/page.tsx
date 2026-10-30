import Link from 'next/link'
import { allowed, requireUser } from '@/lib/auth/next'
import { auditScope } from '@/lib/audit'
import { can } from '@/lib/permissions'
import { dashboardCounts } from '@/lib/metrics'
import { prisma } from '@/lib/db'
import { Card, DISCLAIMERS, Notice, PageHeader, PermissionDenied, Stat, Badge } from '@/components/ui'

export const dynamic = 'force-dynamic'

export default async function AdminDashboard() {
  const s = await requireUser()
  if (!(await allowed(s, 'review:read', '/admin'))) return <PermissionDenied permission="review:read" />
  const scope = await auditScope(s.principal)
  const c = await dashboardCounts(s.user.organizationId)
  const recent = (await prisma.auditLog.findMany({ where: scope.auditWhere, orderBy: { at: 'desc' }, take: 8 })).map(scope.redact)
  const queue = await prisma.ingestionQueueItem.groupBy({ by: ['priorityTier'], _count: true, orderBy: { priorityTier: 'asc' } })
  return (
    <>
      <PageHeader eyebrow="Administration" title="Data operations" subtitle="Data quality, review backlogs, imports and integrations. Live counts from the database; nothing here is estimated or illustrative." />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Canonical ingredients" value={c.ingredients} href="/ingredients" />
        <Stat label="Unresolved identities" value={c.unresolvedIdentities} href="/review?tab=identity" status={c.unresolvedIdentities ? 'warn' : 'good'} />
        <Stat label="Ingredients with reviewed evidence" value={c.reviewedEvidenceIngredients} hint="requires human review" href="/evidence" />
        <Stat label="Evidence records" value={c.evidence} href="/evidence" />
        <Stat label="Products" value={c.products} href="/products" />
        {can(s.principal, 'formula:read') && <Stat label="Formulas (your org)" value={c.formulas} href="/formulas" />}
        {can(s.principal, 'rawmaterial:read') && <Stat label="Supplier materials" value={c.rawMaterials} href="/raw-materials" />}
        <Stat label="Patents" value={c.patents} href="/patents" />
        <Stat label="Outcome relationships" value={c.outcomes} hint={`${c.mockOutcomes} mock (excluded)`} />
        <Stat label="Signals detected" value="—" hint="Phase 3 — not built" />
        <Stat label="Hypotheses under review" value="—" hint="Phase 3 — not built" />
        {can(s.principal, 'ip:read') && <Stat label="Research candidates" value={c.candidates} href="/research-candidates" />}
        <Stat label="Records requiring review" value={c.openReviews} href="/review" status={c.openReviews ? 'warn' : 'good'} />
        <Stat label="Stale regulatory records" value={c.staleRegulatory} hint={`of ${c.regulatoryRecords}`} href="/review?tab=stale" status={c.staleRegulatory ? 'bad' : 'good'} />
        <Stat label="Failed imports" value={c.failedImports} href="/imports" status={c.failedImports ? 'bad' : 'good'} />
      </div>
      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <Card title="Ingestion priority queue" actions={<Link href="/ingredients?sort=priority" className="text-sm">View</Link>}>
          <table><thead><tr><th>Tier</th><th>Meaning</th><th className="text-right">Ingredients</th></tr></thead><tbody>
            {queue.map((q) => (<tr key={q.priorityTier}><td>{q.priorityTier}</td><td className="text-ink-2">{['', 'In current Supernatural products', 'In Hair Passport-logged products', 'In textured-hair products', 'Hair-goal categories', 'Emerging innovation', 'Allergens / restricted / prohibited'][q.priorityTier]}</td><td className="text-right tabular-nums">{q._count}</td></tr>))}
          </tbody></table>
        </Card>
        <Card title="Recent activity" actions={can(s.principal, 'audit:read') ? <Link href="/audit" className="text-sm">Audit history</Link> : undefined}>
          <ul className="space-y-2 text-sm">
            {recent.map((r) => (<li key={String(r.id)} className="flex flex-wrap items-baseline gap-2"><Badge>{r.action}</Badge><span className="text-ink-2">{r.entityType}</span><span className="text-xs text-ink-3">{r.at.toISOString().slice(0, 16).replace('T', ' ')} · {r.actorLabel}</span></li>))}
          </ul>
        </Card>
      </div>
      <Notice title="What this platform can and cannot do">{DISCLAIMERS.limits}</Notice>
    </>
  )
}
