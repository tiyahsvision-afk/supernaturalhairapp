import { notFound } from 'next/navigation'
import { prisma } from '@/lib/db'
import { allowed, requireUser } from '@/lib/auth/next'
import { Badge, Card, KeyValue, PageHeader, PermissionDenied, TableWrap, Button } from '@/components/ui'
import { resumeImportAction } from '../actions'

export const dynamic = 'force-dynamic'

export default async function ImportJobPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ outcome?: string }> }) {
  const s = await requireUser()
  if (!(await allowed(s, 'import:run', '/imports/[id]'))) return <PermissionDenied permission="import:run" />
  const { id } = await params
  const { outcome } = await searchParams
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound()
  const j = await prisma.importJob.findUnique({ where: { id } })
  if (!j) notFound()
  const [records, source] = await Promise.all([prisma.importRecord.findMany({ where: { jobId: id, ...(outcome ? { outcome: outcome as never } : {}) }, orderBy: { rowNumber: 'asc' }, take: 500 }), prisma.source.findUnique({ where: { id: j.sourceId } })])
  const running = j.status === 'RUNNING' || j.status === 'QUEUED'
  return (
    <>
      {running && <meta httpEquiv="refresh" content="3" />}
      <PageHeader eyebrow="Import job" title={`${j.entityType} import · ${j.filename ?? j.id.slice(0, 8)}`} actions={<Badge tone={j.status === 'COMPLETED' ? 'good' : j.status === 'FAILED' ? 'bad' : 'warn'}>{j.status.toLowerCase()}{running && ` · ${j.processedCount}/${j.totalCount}`}</Badge>} />
      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="Job">
          <KeyValue items={[['Source', source?.name], ['Source version', j.sourceVersion], ['Parser version', j.parserVersion], ['File SHA-256', <code key="h" className="break-all text-xs">{j.fileSha256}</code>], ['Rows', `${j.processedCount} of ${j.totalCount} processed (cursor ${j.cursor})`], ['Processing time', j.durationMs !== null ? `${(j.durationMs / 1000).toFixed(1)} s` : '—'], ['Started', j.startedAt?.toISOString()], ['Finished', j.finishedAt?.toISOString()]]} />
          {(j.status === 'FAILED' || j.status === 'QUEUED') && <form action={resumeImportAction} className="mt-3"><input type="hidden" name="jobId" value={j.id} /><Button>Resume from row {j.cursor + 1}</Button></form>}
        </Card>
        <Card title="Counts">
          <KeyValue items={[['Created', j.createdCount], ['Updated', j.updatedCount], ['Unchanged', j.unchangedCount], ['Duplicates', j.duplicateCount], ['Rejected', j.rejectedCount], ['Unresolved / quarantined', j.unresolvedCount], ['Warnings', j.warningCount]]} />
          {(j.errors as { row: number; message: string }[]).length > 0 && <details className="mt-3 text-sm"><summary className="cursor-pointer text-bad">Errors ({(j.errors as unknown[]).length})</summary><ul className="mt-2 space-y-1 text-xs">{(j.errors as { row: number; message: string }[]).map((e, i) => <li key={i}>Row {e.row}: {e.message}</li>)}</ul></details>}
        </Card>
      </div>
      <Card title="Row outcomes" className="mt-4">
        <form className="mb-2 flex gap-2"><select name="outcome" defaultValue={outcome ?? ''} className="w-auto"><option value="">All outcomes</option>{['CREATED', 'UPDATED', 'UNCHANGED', 'DUPLICATE', 'REJECTED', 'QUARANTINED', 'WARNING'].map((o) => <option key={o}>{o}</option>)}</select><button className="text-sm underline">Filter</button></form>
        <TableWrap><table><thead><tr><th>Row</th><th>Key</th><th>Outcome</th><th>Message</th></tr></thead><tbody>
          {records.map((r) => <tr key={r.id}><td className="tabular-nums">{r.rowNumber}</td><td className="mono text-xs">{r.externalKey}</td><td><Badge tone={r.outcome === 'CREATED' || r.outcome === 'UNCHANGED' ? 'good' : r.outcome === 'REJECTED' ? 'bad' : 'warn'}>{r.outcome.toLowerCase()}</Badge></td><td className="text-xs">{r.message}</td></tr>)}
        </tbody></table></TableWrap>
      </Card>
    </>
  )
}
