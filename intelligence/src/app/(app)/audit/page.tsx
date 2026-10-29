import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/db'
import { allowed, requireUser } from '@/lib/auth/next'
import { Badge, PageHeader, Pagination, PermissionDenied, TableWrap, Tabs } from '@/components/ui'

export const dynamic = 'force-dynamic'

export default async function AuditPage({ searchParams }: { searchParams: Promise<{ tab?: string; entity?: string; action?: string; page?: string }> }) {
  const s = await requireUser()
  if (!(await allowed(s, 'audit:read', '/audit'))) return <PermissionDenied permission="audit:read" />
  const sp = await searchParams
  const tab = sp.tab ?? 'changes'
  const page = Math.max(1, Number(sp.page ?? 1))
  const where: Prisma.AuditLogWhereInput = { ...(sp.entity ? { entityType: sp.entity } : {}), ...(sp.action ? { action: { startsWith: sp.action } } : {}) }
  const [rows, total, sec] = await Promise.all([
    tab === 'changes' ? prisma.auditLog.findMany({ where, orderBy: { at: 'desc' }, skip: (page - 1) * 100, take: 100 }) : Promise.resolve([]),
    tab === 'changes' ? prisma.auditLog.count({ where }) : Promise.resolve(0),
    tab === 'security' ? prisma.securityEvent.findMany({ orderBy: { at: 'desc' }, take: 200 }) : Promise.resolve([]),
  ])
  return (
    <>
      <PageHeader title="Audit history" subtitle="Append-only: the database rejects updates and deletes of audit rows." />
      <Tabs active={tab} base="/audit" tabs={[{ key: 'changes', label: 'Changes' }, { key: 'security', label: 'Security events' }]} />
      {tab === 'changes' && (
        <>
          <form className="mb-3 flex flex-wrap gap-2"><input type="hidden" name="tab" value="changes" /><input name="entity" placeholder="Entity type (e.g. Ingredient)" defaultValue={sp.entity} className="max-w-xs" /><input name="action" placeholder="Action prefix (e.g. identity.)" defaultValue={sp.action} className="max-w-xs" /><button className="text-sm underline">Filter</button></form>
          <TableWrap><table><thead><tr><th>When</th><th>Who</th><th>Action</th><th>Entity</th><th>Reason</th><th>Change</th></tr></thead><tbody>
            {rows.map((r) => <tr key={String(r.id)}><td className="whitespace-nowrap text-xs">{r.at.toISOString().replace('T', ' ').slice(0, 19)}</td><td className="text-xs">{r.actorLabel}</td><td><Badge>{r.action}</Badge></td><td className="mono text-xs">{r.entityType}:{r.entityId.slice(0, 8)}</td><td className="text-xs">{r.reason}</td><td>{(r.before || r.after) && <details className="text-xs"><summary className="cursor-pointer">view</summary><pre className="max-h-60 max-w-md overflow-auto whitespace-pre-wrap">{JSON.stringify({ before: r.before, after: r.after }, null, 1)}</pre></details>}</td></tr>)}
          </tbody></table></TableWrap>
          <Pagination page={page} pageSize={100} total={total} base={`/audit?tab=changes${sp.entity ? `&entity=${sp.entity}` : ''}${sp.action ? `&action=${sp.action}` : ''}`} />
        </>
      )}
      {tab === 'security' && (
        <TableWrap><table><thead><tr><th>When</th><th>Type</th><th>User / email</th><th>IP</th><th>Details</th></tr></thead><tbody>
          {sec.map((e) => <tr key={e.id}><td className="whitespace-nowrap text-xs">{e.at.toISOString().replace('T', ' ').slice(0, 19)}</td><td><Badge tone={e.type.includes('FAIL') || e.type.includes('DENIED') || e.type.includes('LOCK') || e.type.includes('INVALID') ? 'warn' : 'neutral'}>{e.type}</Badge></td><td className="mono text-xs">{e.userId?.slice(0, 8) ?? e.email}</td><td className="text-xs">{e.ip}</td><td className="mono text-xs">{JSON.stringify(e.details)}</td></tr>)}
        </tbody></table></TableWrap>
      )}
    </>
  )
}
