import Link from 'next/link'
import { prisma } from '@/lib/db'
import { allowed, requireUser } from '@/lib/auth/next'
import { can, visibilityWhere } from '@/lib/permissions'
import { Badge, Card, Notice, PageHeader, PermissionDenied, TableWrap, Button, DISCLAIMERS } from '@/components/ui'
import { createRawMaterialAction } from './actions'

export const dynamic = 'force-dynamic'

export default async function RawMaterials() {
  const s = await requireUser()
  if (!(await allowed(s, 'rawmaterial:read', '/raw-materials'))) return <PermissionDenied permission="rawmaterial:read" />
  const [rows, suppliers] = await Promise.all([
    prisma.rawMaterial.findMany({ where: visibilityWhere(s.principal, 'rawmaterial:read'), orderBy: { tradeName: 'asc' }, include: { supplier: true, _count: { select: { components: true, documents: true } } } }),
    prisma.supplier.findMany({ orderBy: { name: 'asc' } }),
  ])
  return (
    <>
      <PageHeader eyebrow="Supplier materials (private)" title="Raw materials" subtitle="A raw material is what you buy; it may contain several canonical ingredients. Use levels and active levels are kept separate." />
      <Notice>{DISCLAIMERS.supplier}</Notice>
      <TableWrap><table><thead><tr><th>Trade name</th><th>Supplier</th><th className="text-right">Components</th><th className="text-right">Documents</th><th>Active %</th><th>Status</th></tr></thead><tbody>
        {rows.map((r) => <tr key={r.id}><td><Link href={`/raw-materials/${r.id}`}>{r.tradeName}</Link> {r.isSample && <Badge tone="warn">sample</Badge>}</td><td className="text-sm">{r.supplier?.name}</td><td className="text-right">{r._count.components}</td><td className="text-right">{r._count.documents}</td><td>{r.activePercent !== null ? `${Number(r.activePercent)}% ${r.activePercentConfirmed ? '(confirmed)' : '(unconfirmed)'}` : '—'}</td><td className="text-xs">{r.internalApprovalStatus.toLowerCase()}</td></tr>)}
      </tbody></table></TableWrap>
      {can(s.principal, 'rawmaterial:write') && (
        <Card title="Add raw material" className="mt-6">
          <form action={createRawMaterialAction} className="grid gap-2 sm:grid-cols-4">
            <input name="tradeName" placeholder="Trade name" required className="sm:col-span-2" />
            <select name="supplierId"><option value="">Supplier…</option>{suppliers.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</select>
            <input name="activePercent" placeholder="Declared active % (unconfirmed)" inputMode="decimal" />
            <input name="composition" placeholder="Declared composition (supplier-provided)" className="sm:col-span-3" />
            <Button>Create (restricted)</Button>
          </form>
        </Card>
      )}
    </>
  )
}
