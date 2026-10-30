import { route, json, ApiError } from '@/lib/api/http'
import { getProject } from '@/lib/research/projects'

export const GET = route('research:read', async (ctx, { id }) => {
  const p = /^[0-9a-f-]{36}$/.test(id) ? await getProject(ctx.principal, id) : null
  if (!p) throw new ApiError(404, 'NOT_FOUND', 'Research project not found.')
  return json({ data: { id: p.id, title: p.title, objective: p.objective, workflow: p.workflow, status: p.status, reviewStatus: p.reviewStatus, runs: p.runs.map((r) => ({ id: r.id, createdAt: r.createdAt, engineVersion: r.engineVersion, aiUsed: r.aiUsed })), latest: p.runs[0]?.result ?? null, reports: p.reports.map((r) => ({ id: r.id, type: r.type, createdAt: r.createdAt })) } })
})
