import Link from 'next/link'
import { notFound } from 'next/navigation'
import { prisma } from '@/lib/db'
import { allowed, requireUser } from '@/lib/auth/next'
import { can } from '@/lib/permissions'
import { getProject, WORKFLOWS } from '@/lib/research/projects'
import type { WorkflowResult } from '@/lib/research/types'
import { ActionForm } from '@/components/ActionForm'
import { ResultView } from '@/components/research'
import { Badge, Card, Notice, PageHeader, PermissionDenied, ReviewBadge } from '@/components/ui'
import { addMemberAction, generateReportAction, requestReviewAction, rerunAction, updateProjectAction } from '../actions'

export const dynamic = 'force-dynamic'

export default async function ProjectPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ run?: string }> }) {
  const s = await requireUser()
  if (!(await allowed(s, 'research:read', '/workbench/[id]'))) return <PermissionDenied permission="research:read" />
  const { id } = await params
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound()
  const project = await getProject(s.principal, id)
  if (!project) notFound()
  const { run: runId } = await searchParams
  const run = project.runs.find((r) => r.id === runId) ?? project.runs[0]
  const canWrite = can(s.principal, 'research:write') && !project.members.some((m) => m.userId === s.user.id && m.role === 'VIEWER')
  const people = await prisma.user.findMany({ where: { id: { in: [...project.members.map((m) => m.userId), ...(project.createdById ? [project.createdById] : [])] } }, select: { id: true, name: true, email: true } })
  const who = (uid: string | null) => people.find((p) => p.id === uid)?.name ?? 'Unknown'
  const meta = WORKFLOWS[project.workflow]
  const result = run?.result as unknown as WorkflowResult | undefined
  return (
    <>
      <PageHeader eyebrow={`${meta.label} · created by ${who(project.createdById)} · ${project.createdAt.toISOString().slice(0, 10)}`} title={project.title}
        subtitle={<span className="flex flex-wrap items-center gap-1.5"><Badge>{project.status.toLowerCase().replace('_', ' ')}</Badge><ReviewBadge status={project.reviewStatus} /><Badge>{project.visibility === 'RESTRICTED' ? 'members only' : 'visible to your organization'}</Badge>{run?.aiUsed && <Badge tone="warn">includes AI-written text ({run.aiModel})</Badge>}</span>}
        actions={<>
          <ActionForm action={generateReportAction} submitLabel="Generate report" pendingLabel="Generating…" className="flex items-center gap-2"><input type="hidden" name="projectId" value={project.id} /><input type="hidden" name="runId" value={run?.id ?? ''} /></ActionForm>
          {canWrite && <ActionForm action={rerunAction} submitLabel="Re-run with latest data" pendingLabel="Re-running…" className="flex items-center gap-2"><input type="hidden" name="projectId" value={project.id} /></ActionForm>}
        </>} />

      {project.reviewStatus === 'RE_REVIEW_REQUIRED' && <Notice kind="warn" title="Findings changed after review">A newer run exists since this project was signed off. Request review again before relying on it.</Notice>}
      <div className="grid gap-6 lg:grid-cols-[1fr_18rem]">
        <div className="min-w-0">
          <Card title="Research objective" className="mb-6">
            {canWrite ? (
              <form action={updateProjectAction} className="space-y-2">
                <input type="hidden" name="projectId" value={project.id} />
                <textarea name="objective" rows={2} defaultValue={project.objective} aria-label="Research objective" />
                <button className="rounded-full border border-line px-3 py-1 text-xs">Save objective</button>
              </form>
            ) : <p className="text-sm text-ink-2">{project.objective}</p>}
          </Card>
          {result ? <ResultView result={result} /> : <Notice title="No runs yet">Run the research to see results.</Notice>}
        </div>
        <aside className="space-y-4">
          <Card title="History">
            <ol className="space-y-1.5 text-sm">{project.runs.map((r, i) => (
              <li key={r.id}><Link href={`/workbench/${project.id}?run=${r.id}`} className={r.id === run?.id ? 'font-semibold' : ''}>Run {project.runs.length - i}</Link> <span className="text-xs text-ink-3">{r.createdAt.toISOString().slice(0, 16).replace('T', ' ')} · {r.engineVersion}{r.aiUsed ? ' · AI' : ''}</span></li>
            ))}</ol>
          </Card>
          <Card title="Reports">
            {project.reports.length ? <ul className="space-y-1 text-sm">{project.reports.map((r) => <li key={r.id}><Link href={`/reports/${r.id}`}>{r.createdAt.toISOString().slice(0, 16).replace('T', ' ')}</Link></li>)}</ul> : <p className="text-sm text-ink-3">None yet. Reports freeze a run with its sources and verification status.</p>}
          </Card>
          {canWrite && (
            <Card title="Review & status">
              {project.reviewStatus !== 'SUBMITTED' && project.status !== 'IN_REVIEW' && (
                <form action={requestReviewAction} className="mb-3 space-y-2"><input type="hidden" name="projectId" value={project.id} /><input name="notes" placeholder="Note for the reviewer (optional)" aria-label="Note for reviewer" /><button className="w-full rounded-full border border-line px-3 py-1.5 text-sm">Request qualified review</button></form>
              )}
              <form action={updateProjectAction} className="flex gap-2"><input type="hidden" name="projectId" value={project.id} />
                <select name="status" defaultValue={project.status} aria-label="Project status">{['OPEN', 'IN_REVIEW', 'COMPLETE', 'ARCHIVED'].map((x) => <option key={x} value={x}>{x.toLowerCase().replace('_', ' ')}</option>)}</select>
                <button className="rounded-full border border-line px-3 py-1 text-xs">Set</button></form>
              <p className="mt-2 text-xs text-ink-3">Reviews are decided by qualified reviewers in your organization only.</p>
            </Card>
          )}
          <Card title="Collaboration">
            <p className="mb-2 text-xs text-ink-3">{project.visibility === 'RESTRICTED' ? 'Only the creator and members below can open this project.' : 'Everyone in your organization with research access can open this project.'}</p>
            {project.members.length > 0 && <ul className="mb-2 space-y-1 text-sm">{project.members.map((m) => <li key={m.userId}>{who(m.userId)} <span className="text-xs text-ink-3">· {m.role.toLowerCase()}</span></li>)}</ul>}
            {canWrite && (
              <>
                <ActionForm action={addMemberAction} submitLabel="Add member" className="space-y-2"><input type="hidden" name="projectId" value={project.id} /><input name="email" type="email" required placeholder="colleague@yourcompany.com" aria-label="Member email" /><select name="role" defaultValue="EDITOR" aria-label="Member role"><option value="EDITOR">Editor</option><option value="VIEWER">Viewer</option></select></ActionForm>
                <form action={updateProjectAction} className="mt-3 flex gap-2"><input type="hidden" name="projectId" value={project.id} /><select name="visibility" defaultValue={project.visibility} aria-label="Visibility"><option value="ORGANIZATION">Organization</option><option value="RESTRICTED">Members only</option></select><button className="rounded-full border border-line px-3 py-1 text-xs">Set</button></form>
              </>
            )}
          </Card>
          <Card title="Inputs">
            <pre className="max-h-64 overflow-auto whitespace-pre-wrap break-words text-xs text-ink-2">{JSON.stringify(run?.input ?? project.inputs, null, 2)}</pre>
          </Card>
        </aside>
      </div>
    </>
  )
}
