import { route, json, ApiError } from '@/lib/api/http'
import { search, logSearch } from '@/lib/search'

export const GET = route('search:read', async (ctx) => {
  const u = new URL(ctx.req.url)
  const q = u.searchParams.get('q')?.trim() ?? ''
  if (!q) throw new ApiError(400, 'MISSING_QUERY', 'Provide q.')
  if (q.length > 200) throw new ApiError(400, 'QUERY_TOO_LONG', 'Query must be at most 200 characters.')
  const type = u.searchParams.get('type')
  const limit = Math.min(100, Number(u.searchParams.get('limit') ?? 25) || 25)
  const res = await search(ctx.principal, q, { types: type ? [type] : undefined, limit })
  await logSearch(ctx.principal.kind === 'USER' ? ctx.principal.id : null, q, { type, via: 'api' }, res.hits.length, res.durationMs)
  return json({ data: res.hits, suggestions: res.suggestions, durationMs: res.durationMs })
})
