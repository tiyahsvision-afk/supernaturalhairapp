import { prisma } from '@/lib/db'
import { allowed, requireUser } from '@/lib/auth/next'
import { can } from '@/lib/permissions'
import { Card, PageHeader, PermissionDenied, TableWrap, Button, EmptyState } from '@/components/ui'
import { createSupplierAction } from '../raw-materials/actions'

export const dynamic = 'force-dynamic'

export default async function Suppliers() {
  const s = await requireUser()
  if (!(await allowed(s, 'supplier:read', '/suppliers'))) return <PermissionDenied permission="supplier:read" />
  const rows = await prisma.supplier.findMany({ orderBy: { name: 'asc' }, include: { _count: { select: { rawMats: true, documents: true } } } })
  return (
    <>
      <PageHeader title="Suppliers" subtitle="Supplier records. Raw materials and documents are private to the organization that holds them." />
      {rows.length === 0 ? <EmptyState title="No suppliers" /> : (
        <TableWrap><table><thead><tr><th>Supplier</th><th>Type</th><th>Country</th><th className="text-right">Raw materials (all orgs)</th><th>Notes</th></tr></thead><tbody>
          {rows.map((r) => <tr key={r.id}><td>{r.website ? <a href={r.website} target="_blank" rel="noreferrer">{r.name}</a> : r.name}</td><td>{r.type}</td><td>{r.country}</td><td className="text-right">{r._count.rawMats}</td><td className="text-xs text-ink-3">{r.notes}</td></tr>)}
        </tbody></table></TableWrap>
      )}
      {can(s.principal, 'supplier:write') && (
        <Card title="Add supplier" className="mt-6">
          <form action={createSupplierAction} className="grid gap-2 sm:grid-cols-5"><input name="name" placeholder="Name" required className="sm:col-span-2" /><input name="website" type="url" placeholder="Website" /><input name="country" placeholder="Country" /><Button>Add</Button></form>
        </Card>
      )}
    </>
  )
}
