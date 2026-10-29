import { z } from 'zod'
import { prisma } from '@/lib/db'
import { route, json, ApiError, pageParams, paginate } from '@/lib/api/http'
import { createImportJob, importBlockedReason, startImportInBackground } from '@/lib/import/engine'

export const GET = route('import:run', async (ctx) => {
  const { limit, cursor } = pageParams(ctx.req)
  const rows = await prisma.importJob.findMany({
    omit: { rows: true },
    orderBy: { id: 'asc' }, take: limit + 1, ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
  })
  return json(paginate(rows, limit))
})

const ImportSchema = z.object({ sourceKey: z.string(), entityType: z.string(), format: z.enum(['csv', 'json']), content: z.string().min(1).max(20 * 1024 * 1024), filename: z.string().max(200).optional(), sourceVersion: z.string().max(100).optional() })

export const POST = route('import:run', async (ctx) => {
  const body = ImportSchema.parse(await ctx.req.json())
  const src = await prisma.source.findUnique({ where: { key: body.sourceKey } })
  if (!src) throw new ApiError(422, 'UNKNOWN_SOURCE', `Unknown sourceKey: ${body.sourceKey}`)
  const blocked = importBlockedReason(src)
  if (blocked) throw new ApiError(403, 'SOURCE_RIGHTS', blocked)
  const job = await createImportJob(ctx.principal, { sourceId: src.id, kind: body.format === 'csv' ? 'CSV' : 'JSON', entityType: body.entityType, filename: body.filename, content: body.content, sourceVersion: body.sourceVersion })
    .catch((e: Error) => { throw new ApiError(422, 'IMPORT_REJECTED', e.message) })
  if (job.status === 'QUEUED') startImportInBackground(job.id, ctx.principal)
  return json({ data: { jobId: job.id, status: job.status, totalCount: job.totalCount } }, 202)
})
