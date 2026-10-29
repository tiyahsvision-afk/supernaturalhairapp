import Link from 'next/link'
import { prisma } from '@/lib/db'
import { allowed, requireUser } from '@/lib/auth/next'
import { can, visibilityWhere } from '@/lib/permissions'
import { Badge, EmptyState, LinkButton, PageHeader, PermissionDenied, TableWrap, Notice } from '@/components/ui'

export const dynamic = 'force-dynamic'

export default async function FormulasPage() {
  const s = await requireUser()
  if (!(await allowed(s, 'formula:read', '/formulas'))) return <PermissionDenied permission="formula:read" />
  const rows = await prisma.formula.findMany({ where: visibilityWhere(s.principal), orderBy: { code: 'asc' }, include: { versions: { orderBy: { versionNumber: 'desc' }, take: 1, include: { _count: { select: { lines: true } } } } } })
  return (
    <>
      <PageHeader eyebrow="Private to your organization" title="Formulas" subtitle="Formula candidates are research candidates until a cosmetic chemist reviews them. The system never marks a formula safe or commercially approved."
        actions={can(s.principal, 'formula:write') ? <LinkButton href="/formulas/new" variant="primary">New formula</LinkButton> : undefined} />
      {rows.some((r) => r.isSample) && <Notice kind="warn" title="Sample formulas">Records marked SAMPLE are illustrative archetypes for testing the platform. They are not Supernatural formulas and are not for manufacture.</Notice>}
      {rows.length === 0 ? <EmptyState title="No formulas visible to you">Formulas are private to their owner organization and restricted to authorized roles.</EmptyState> : (
        <TableWrap><table><thead><tr><th>Code</th><th>Name</th><th>Category</th><th>Latest version</th><th>Status</th><th>Chemist review</th><th>Visibility</th></tr></thead><tbody>
          {rows.map((f) => { const v = f.versions[0]; return (
            <tr key={f.id}><td className="mono"><Link href={`/formulas/${f.id}`}>{f.code}</Link></td><td>{f.name} {f.isSample && <Badge tone="warn">SAMPLE</Badge>}</td><td className="text-sm">{f.productCategory}</td><td>v{v?.versionNumber} · {v?._count.lines} lines</td><td><Badge>{v?.status.replace(/_/g, ' ').toLowerCase()}</Badge></td><td className="text-xs">{v?.chemistReviewStatus.toLowerCase()}</td><td><Badge tone="brand">{f.visibility.toLowerCase()}</Badge></td></tr>) })}
        </tbody></table></TableWrap>
      )}
    </>
  )
}
