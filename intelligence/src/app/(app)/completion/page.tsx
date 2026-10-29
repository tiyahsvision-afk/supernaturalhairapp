import { requireUser } from '@/lib/auth/next'
import { phase1Requirements, type ReqStatus } from '@/lib/metrics'
import { Badge, Notice, PageHeader, TableWrap } from '@/components/ui'

export const dynamic = 'force-dynamic'
const TONE: Record<ReqStatus, 'good' | 'warn' | 'bad' | 'neutral'> = { MET: 'good', VERIFIED_BY_TEST: 'good', PARTIAL: 'warn', NEEDS_QUALIFIED_REVIEW: 'warn', BLOCKED_NO_DOCUMENTS: 'warn', NOT_MET: 'bad', NOT_VERIFIED: 'warn', TEST_FAILING: 'bad' }
const LABEL: Record<ReqStatus, string> = { MET: 'Met', VERIFIED_BY_TEST: 'Verified by automated test', PARTIAL: 'Partially met', NEEDS_QUALIFIED_REVIEW: 'Needs qualified review', BLOCKED_NO_DOCUMENTS: 'Blocked — no documents', NOT_MET: 'Not met', NOT_VERIFIED: 'Not yet verified', TEST_FAILING: 'Test failing' }

export default async function Completion() {
  await requireUser()
  const reqs = await phase1Requirements()
  const groups = [...new Set(reqs.map((r) => r.group))]
  return (
    <>
      <PageHeader eyebrow="Live status — computed from the database" title="Phase 1 completion" subtitle="This is a status report, not a claim of scientific validation. Items that depend on qualified human review are not marked as met." />
      <Notice kind="warn" title="The platform is not scientifically validated">It organizes source-backed records and review workflows. Seeded classifications, regulatory drafts and graph relationships await qualified review.</Notice>
      {groups.map((g) => (
        <section key={g} className="mb-6">
          <h2 className="mb-2 text-xl">{g}</h2>
          <TableWrap><table><thead><tr><th>Requirement</th><th>Target</th><th>Actual</th><th>Status</th><th>Notes</th></tr></thead><tbody>
            {reqs.filter((r) => r.group === g).map((r) => <tr key={r.label}><td className="min-w-56">{r.label}</td><td className="text-sm">{r.target ?? '—'}</td><td className="text-sm tabular-nums">{r.actual ?? '—'}</td><td><Badge tone={TONE[r.status]}>{LABEL[r.status]}</Badge></td><td className="text-xs text-ink-2">{r.note}</td></tr>)}
          </tbody></table></TableWrap>
        </section>
      ))}
    </>
  )
}
