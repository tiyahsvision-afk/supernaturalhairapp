import Link from 'next/link'
import { prisma } from '@/lib/db'
import { allowed, requireUser } from '@/lib/auth/next'
import { can } from '@/lib/permissions'
import { Badge, LinkButton, PageHeader, PermissionDenied, TableWrap, EmptyState } from '@/components/ui'

export const dynamic = 'force-dynamic'

export default async function ProductsPage() {
  const s = await requireUser()
  if (!(await allowed(s, 'product:read', '/products'))) return <PermissionDenied permission="product:read" />
  const rows = await prisma.product.findMany({ where: { OR: [{ ownerOrgId: null }, { ownerOrgId: s.principal.organizationId }] }, orderBy: [{ isSupernatural: 'desc' }, { brand: 'asc' }], include: { versions: { where: { validTo: null }, include: { lines: { select: { parsingStatus: true } } } } } })
  return (
    <>
      <PageHeader eyebrow="Declared ingredient lists" title="Products" subtitle="Ingredient lists are stored in displayed order and versioned over time. Order never implies concentration." actions={can(s.principal, 'product:write') ? <LinkButton href="/products/new" variant="primary">Add product</LinkButton> : undefined} />
      {rows.length === 0 ? <EmptyState title="No products yet" /> : (
        <TableWrap><table><thead><tr><th>Product</th><th>Category</th><th>Barcode</th><th className="text-right">Lines</th><th className="text-right">Need identity review</th><th>Version</th></tr></thead><tbody>
          {rows.map((p) => { const v = p.versions[0]; const pending = v?.lines.filter((l) => l.parsingStatus !== 'MATCHED').length ?? 0; return (
            <tr key={p.id}><td><Link href={`/products/${p.id}`}>{p.brand} — {p.name}</Link> {p.isSupernatural && <Badge tone="brand">Supernatural</Badge>}</td><td className="text-sm">{p.category}</td><td className="mono text-xs">{p.barcode ?? '—'}</td><td className="text-right tabular-nums">{v?.lines.length ?? 0}</td><td className="text-right">{pending ? <Badge tone="warn">{pending}</Badge> : <Badge tone="good">0</Badge>}</td><td>v{v?.versionNumber}</td></tr>) })}
        </tbody></table></TableWrap>
      )}
    </>
  )
}
