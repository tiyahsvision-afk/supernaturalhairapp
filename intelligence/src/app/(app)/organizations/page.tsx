import { prisma } from '@/lib/db'
import { allowed, requireUser } from '@/lib/auth/next'
import { Badge, Notice, PageHeader, PermissionDenied, TableWrap } from '@/components/ui'

export const dynamic = 'force-dynamic'

export default async function Organizations() {
  const s = await requireUser()
  if (!(await allowed(s, 'org:manage', '/organizations'))) return <PermissionDenied permission="org:manage" />
  const orgs = await prisma.organization.findMany({ include: { _count: { select: { users: true, formulas: true, rawMats: true, candidates: true, apiKeys: true } } }, orderBy: { name: 'asc' } })
  return (
    <>
      <PageHeader title="Organizations" subtitle="Private formulas, raw materials, documents and research candidates are isolated per organization. There is no cross-organization bypass." />
      <Notice>Subscription and data-entitlement flags exist (entitlements) but billing is not built — Phase 5.</Notice>
      <TableWrap><table><thead><tr><th>Organization</th><th>Type</th><th className="text-right">Users</th><th className="text-right">Formulas</th><th className="text-right">Raw materials</th><th className="text-right">Candidates</th><th className="text-right">API keys</th><th>Entitlements</th></tr></thead><tbody>
        {orgs.map((o) => <tr key={o.id}><td>{o.name}{o.id === s.user.organizationId && <> <Badge tone="brand">yours</Badge></>}</td><td className="text-xs">{o.type.toLowerCase()}</td>{[o._count.users, o._count.formulas, o._count.rawMats, o._count.candidates, o._count.apiKeys].map((n, i) => <td key={i} className="text-right">{n}</td>)}<td className="mono text-xs">{JSON.stringify(o.entitlements)}</td></tr>)}
      </tbody></table></TableWrap>
    </>
  )
}
