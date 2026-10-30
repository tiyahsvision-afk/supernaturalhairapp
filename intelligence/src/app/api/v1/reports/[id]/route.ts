import { route, json, ApiError } from '@/lib/api/http'
import { getReport } from '@/lib/research/projects'

export const GET = route('research:read', async (ctx, { id }) => {
  const r = /^[0-9a-f-]{36}$/.test(id) ? await getReport(ctx.principal, id) : null
  if (!r) throw new ApiError(404, 'NOT_FOUND', 'Report not found.')
  return json({ data: { id: r.id, type: r.type, title: r.title, createdAt: r.createdAt, snapshot: r.snapshot } })
})
