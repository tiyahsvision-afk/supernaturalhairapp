import Link from 'next/link'
import { notFound } from 'next/navigation'
import { allowed, requireUser } from '@/lib/auth/next'
import { STATUS_META, type DataStatus } from '@/lib/dimensions'
import { getReport } from '@/lib/research/projects'
import type { WorkflowResult } from '@/lib/research/types'
import { PrintButton } from '@/components/ActionForm'
import { StatusPill } from '@/components/intel'
import { ResultView } from '@/components/research'
import { PermissionDenied, ReviewBadge } from '@/components/ui'

export const dynamic = 'force-dynamic'

interface Snapshot { objective: string; workflow: string; projectReviewStatus: string; runId: string; runAt: string; engineVersion: string; aiUsed: boolean; aiModel: string | null; author: string; result: WorkflowResult }

export default async function ReportPage({ params }: { params: Promise<{ id: string }> }) {
  const s = await requireUser()
  if (!(await allowed(s, 'research:read', '/reports/[id]'))) return <PermissionDenied permission="research:read" />
  const { id } = await params
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound()
  const r = await getReport(s.principal, id)
  if (!r) notFound()
  const snap = r.snapshot as unknown as Snapshot
  const v = Object.entries(snap.result.verification ?? {}).filter(([, n]) => n) as [DataStatus, number][]
  return (
    <article className="mx-auto max-w-4xl print:max-w-none">
      <div className="mb-4 flex items-center justify-between gap-2 print:hidden">
        {r.project ? <Link href={`/workbench/${r.project.id}`} className="text-sm">← Back to project</Link> : <span />}
        <PrintButton />
      </div>
      <header className="mb-6 rounded-2xl border border-line bg-paper p-6 print:border-0 print:p-0">
        <div className="flex items-center gap-2 text-sm text-brand-700"><span className="inline-block h-4 w-4 rounded-full bg-brand" aria-hidden />Supernatural Ingredient Intelligence</div>
        <div className="mt-4 text-xs font-semibold uppercase tracking-widest text-ink-3">{r.type}</div>
        <h1 className="mt-1 text-3xl leading-tight text-ink">{snap.result.headline}</h1>
        <dl className="mt-4 grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
          <div><dt className="text-ink-3">Research objective</dt><dd className="text-ink">{snap.objective}</dd></div>
          <div><dt className="text-ink-3">Generated</dt><dd className="text-ink">{r.createdAt.toISOString().slice(0, 16).replace('T', ' ')} UTC by {snap.author}</dd></div>
          <div><dt className="text-ink-3">Data verification status</dt><dd className="mt-1 flex flex-wrap gap-1.5">{v.length ? v.map(([k, n]) => <span key={k} className="inline-flex items-center gap-1"><StatusPill status={k} /><span className="text-xs text-ink-3">×{n}</span></span>) : <span className="text-ink-2">Not applicable to this report type</span>}</dd></div>
          <div><dt className="text-ink-3">Human review at generation</dt><dd className="mt-1"><ReviewBadge status={snap.projectReviewStatus} /></dd></div>
        </dl>
        <p className="mt-4 rounded-xl border border-line bg-paper-2 p-3 text-xs text-ink-2">Research decision support. Not a finished or safety-tested formulation, a safety assessment, regulatory or legal advice, or proof of performance. {snap.aiUsed ? `Parts of this report were written by an AI model (${snap.aiModel}) constrained to cite platform records; verify each point against its sources. ` : ''}Data statuses: {Object.entries(STATUS_META).map(([, m]) => m.label).join(', ')}.</p>
      </header>
      <ResultView result={snap.result} />
      <footer className="mt-8 border-t border-line pt-3 text-xs text-ink-3">Report {r.id} · run {snap.runId} ({snap.runAt}) · engine {snap.engineVersion} · Supernatural Ingredient Intelligence</footer>
    </article>
  )
}
