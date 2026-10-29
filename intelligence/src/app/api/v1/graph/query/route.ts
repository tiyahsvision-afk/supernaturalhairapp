import { z } from 'zod'
import { NodeType } from '@prisma/client'
import { route, json } from '@/lib/api/http'
import { postgresGraphStore } from '@/lib/services/graph'

const QuerySchema = z.object({ type: z.nativeEnum(NodeType), id: z.string().uuid(), edgeTypes: z.array(z.string()).max(30).optional(), limit: z.number().int().min(1).max(500).default(100) })

export const POST = route('graph:read', async (ctx) => {
  const q = QuerySchema.parse(await ctx.req.json())
  const result = await postgresGraphStore.neighborhood(ctx.principal, q.type, q.id, { edgeTypes: q.edgeTypes, limit: q.limit })
  return json({ data: result, notice: 'Unreviewed edges are machine-proposed. Edges represent recorded associations, not causation.' })
})
