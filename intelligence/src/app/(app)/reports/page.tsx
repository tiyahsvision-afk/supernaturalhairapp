import Link from 'next/link'
import { prisma } from '@/lib/db'
import { allowed, requireUser } from '@/lib/auth/next'
import { projectListWhere } from '@/lib/research/projects'
import { EmptyState, PageHeader, PermissionDenied, TableWrap } from '@/components/ui'

export const dynamic = 'force-dynamic'

export default async function ReportsPage() {
  const s = await requireUser()
  if (!(await allowed(s, 'research:read', '/reports'))) return <PermissionDenied permission="research:read" />
  const reports = await prisma.researchReport.findMany({ where: { organizationId: s.principal.organizationId, OR: [{ projectId: null }, { project: projectListWhere(s.principal) }] }, orderBy: { createdAt: 'desc' }, take: 200, include: { project: { select: { id: true, title: true } } } })
  return (
    <>
      <PageHeader eyebrow="Workspace" title="Report history" subtitle="Every report is an immutable snapshot of a research run, with its sources and verification status at the time it was generated." />
      {reports.length === 0 ? <EmptyState title="No reports yet">Open a research project and choose “Generate report”.</EmptyState> : (
        <TableWrap><table>
          <thead><tr><th>Report</th><th>Type</th><th>Project</th><th>Generated</th></tr></thead>
          <tbody>{reports.map((r) => <tr key={r.id}><td><Link href={`/reports/${r.id}`} className="font-medium">{r.title}</Link></td><td className="text-xs">{r.type}</td><td className="text-xs">{r.project ? <Link href={`/workbench/${r.project.id}`}>{r.project.title}</Link> : '—'}</td><td className="whitespace-nowrap text-xs text-ink-3">{r.createdAt.toISOString().slice(0, 16).replace('T', ' ')}</td></tr>)}</tbody>
        </table></TableWrap>
      )}
    </>
  )
}
