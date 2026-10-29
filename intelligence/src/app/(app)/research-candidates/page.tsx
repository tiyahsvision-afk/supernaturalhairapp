import { prisma } from '@/lib/db'
import { allowed, requireUser } from '@/lib/auth/next'
import { can } from '@/lib/permissions'
import { createCandidateAction } from './actions'
import { Badge, Card, Notice, PageHeader, PermissionDenied, TableWrap, Button, EmptyState } from '@/components/ui'

export const dynamic = 'force-dynamic'

export default async function Candidates() {
  const s = await requireUser()
  if (!(await allowed(s, 'ip:read', '/research-candidates'))) return <PermissionDenied permission="ip:read" note="research candidates may contain potential intellectual property" />
  // Organization-scoped: candidates of other organizations are never returned.
  const rows = await prisma.researchCandidate.findMany({ where: { ownerOrgId: s.user.organizationId }, orderBy: { code: 'asc' } })
  return (
    <>
      <PageHeader eyebrow="Confidential — potential IP" title="Research candidates" subtitle="Evidence-supported candidates for investigation. None is a validated discovery." />
      <Notice kind="warn" title="Confidential">Do not share outside authorized roles. Disclosure can affect patentability. Signals-to-candidate promotion and IP review workflows arrive in Phases 3–4.</Notice>
      {rows.length === 0 ? <EmptyState title="No research candidates" /> : (
        <TableWrap><table><thead><tr><th>Code</th><th>Title</th><th>Type</th><th>Research</th><th>Safety</th><th>IP</th><th>Visibility</th></tr></thead><tbody>
          {rows.map((r) => <tr key={r.id}><td className="mono">{r.code}</td><td>{r.title}<div className="text-xs text-ink-3">{r.description}</div></td><td className="text-xs">{r.candidateType}</td><td className="text-xs">{r.researchStatus.toLowerCase()}</td><td className="text-xs">{r.safetyStatus.toLowerCase()}</td><td className="text-xs">{r.ipStatus.toLowerCase()}</td><td><Badge tone="warn">{r.visibility.toLowerCase().replace('_', ' ')}</Badge></td></tr>)}
        </tbody></table></TableWrap>
      )}
      {can(s.principal, 'ip:write') && (
        <Card title="New research candidate" className="mt-6">
          <form action={createCandidateAction} className="grid gap-2 sm:grid-cols-3">
            <input name="title" placeholder="Title" required className="sm:col-span-2" />
            <select name="candidateType">{['existing ingredient', 'ingredient combination', 'botanical fraction', 'fermentation-derived compound', 'peptide', 'protein', 'lipid', 'polymer', 'delivery technology', 'processing method', 'formula architecture', 'other novel material'].map((t) => <option key={t}>{t}</option>)}</select>
            <textarea name="description" placeholder="Description" required className="sm:col-span-3" rows={2} />
            <textarea name="hypothesis" placeholder="Hypothesis (to be tested — not a claim)" className="sm:col-span-3" rows={2} />
            <Button>Create (confidential)</Button>
          </form>
        </Card>
      )}
    </>
  )
}
