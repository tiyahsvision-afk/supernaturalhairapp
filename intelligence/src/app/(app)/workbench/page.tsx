import Link from 'next/link'
import { prisma } from '@/lib/db'
import { allowed, requireUser } from '@/lib/auth/next'
import { planFor, usageThisMonth } from '@/lib/entitlements'
import { projectListWhere, WORKFLOWS } from '@/lib/research/projects'
import { Badge, EmptyState, PageHeader, PermissionDenied, ReviewBadge, TableWrap } from '@/components/ui'

export const dynamic = 'force-dynamic'

const START: { workflow: keyof typeof WORKFLOWS; href?: string; icon: string }[] = [
  { workflow: 'SUBSTITUTES', icon: '⇄' }, { workflow: 'FORMULATION', icon: '⚗' }, { workflow: 'CLAIM', icon: '❝' },
  { workflow: 'SUPPLIERS', icon: '▤' }, { workflow: 'COMPARISON', icon: '⊞' }, { workflow: 'PRODUCT_BRIEF', href: '/founder', icon: '✦' },
]

export default async function WorkbenchPage() {
  const s = await requireUser()
  if (!(await allowed(s, 'research:read', '/workbench'))) return <PermissionDenied permission="research:read" />
  const [projects, reports, org, usage] = await Promise.all([
    prisma.researchProject.findMany({ where: projectListWhere(s.principal), orderBy: { updatedAt: 'desc' }, take: 50, include: { _count: { select: { runs: true, reports: true } } } }),
    prisma.researchReport.findMany({ where: { organizationId: s.principal.organizationId, OR: [{ projectId: null }, { project: projectListWhere(s.principal) }] }, orderBy: { createdAt: 'desc' }, take: 6 }),
    prisma.organization.findUniqueOrThrow({ where: { id: s.principal.organizationId } }),
    usageThisMonth(s.principal.organizationId),
  ])
  const plan = planFor(org)
  return (
    <>
      <PageHeader eyebrow="Research workbench" title="Start with a question" subtitle="Each workflow investigates a real decision using the platform’s records, saves the result as a project with full citations, and turns it into a report when you are ready." />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {START.map((x) => {
          const w = WORKFLOWS[x.workflow]
          return (
            <Link key={x.workflow} href={x.href ?? `/workbench/new?workflow=${x.workflow}`} className="group rounded-2xl border border-line bg-paper p-5 no-underline transition hover:border-brand hover:shadow-sm">
              <div className="mb-2 flex h-9 w-9 items-center justify-center rounded-xl bg-brand-100 text-lg text-brand-700" aria-hidden>{x.icon}</div>
              <div className="font-serif text-lg text-ink group-hover:text-brand-700">{w.label}</div>
              <p className="mt-1 text-sm text-ink-2">{w.blurb}</p>
            </Link>
          )
        })}
      </div>
      <form action="/workbench/new" className="mt-4 flex flex-col gap-2 rounded-2xl border border-line bg-paper-2 p-4 sm:flex-row sm:items-center">
        <input type="hidden" name="workflow" value="GENERAL" />
        <span className="text-sm font-medium text-ink">Or ask the research assistant</span>
        <span className="text-xs text-ink-3 sm:flex-1">Answers only from platform records, with citations.</span>
        <button className="rounded-full border border-line bg-paper px-4 py-1.5 text-sm">Ask a question</button>
      </form>

      <section className="mt-8">
        <div className="mb-2 flex items-end justify-between"><h2 className="text-xl text-ink">Saved research projects</h2><span className="text-xs text-ink-3">{plan.label} plan · this month: {usage['research.run'] ?? 0} runs, {usage['report.generate'] ?? 0} reports{plan.limits['research.run'] != null ? ` of ${plan.limits['research.run']}/${plan.limits['report.generate']}` : ''}</span></div>
        {projects.length === 0 ? <EmptyState title="No research projects yet">Start one of the workflows above; results are saved here for your team.</EmptyState> : (
          <TableWrap>
            <table>
              <thead><tr><th>Project</th><th>Workflow</th><th>Status</th><th>Review</th><th className="text-right">Runs</th><th className="text-right">Reports</th><th>Updated</th></tr></thead>
              <tbody>{projects.map((p) => (
                <tr key={p.id}>
                  <td className="min-w-56"><Link href={`/workbench/${p.id}`} className="font-medium">{p.title}</Link>{p.visibility === 'RESTRICTED' && <span className="ml-1 text-xs text-ink-3">· restricted</span>}</td>
                  <td className="text-xs">{WORKFLOWS[p.workflow].short}</td>
                  <td><Badge>{p.status.toLowerCase().replace('_', ' ')}</Badge></td>
                  <td><ReviewBadge status={p.reviewStatus} /></td>
                  <td className="text-right tabular-nums">{p._count.runs}</td>
                  <td className="text-right tabular-nums">{p._count.reports}</td>
                  <td className="whitespace-nowrap text-xs text-ink-3">{p.updatedAt.toISOString().slice(0, 10)}</td>
                </tr>
              ))}</tbody>
            </table>
          </TableWrap>
        )}
      </section>
      {reports.length > 0 && (
        <section className="mt-8">
          <div className="mb-2 flex items-end justify-between"><h2 className="text-xl text-ink">Recent reports</h2><Link href="/reports" className="text-sm">All reports</Link></div>
          <ul className="grid gap-2 sm:grid-cols-2">{reports.map((r) => <li key={r.id}><Link href={`/reports/${r.id}`} className="block rounded-xl border border-line bg-paper p-3 no-underline hover:border-brand"><span className="text-xs uppercase tracking-wide text-ink-3">{r.type}</span><span className="block text-ink">{r.title}</span><span className="text-xs text-ink-3">{r.createdAt.toISOString().slice(0, 16).replace('T', ' ')}</span></Link></li>)}</ul>
        </section>
      )}
    </>
  )
}
