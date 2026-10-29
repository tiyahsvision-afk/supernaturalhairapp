import { route, json, ApiError } from '@/lib/api/http'
import { processBatch } from '@/lib/integration/hair-passport'

export const POST = route('integration:manage', async (ctx) => {
  const body = await ctx.req.json()
  const result = await processBatch(ctx.principal, body).catch((e: Error) => { throw new ApiError(422, 'BATCH_REJECTED', e.message) })
  return json({
    data: result,
    notice: result.isMock
      ? 'Mock batch. The Hair Passport connection has not been validated; mock records are excluded from analyses by default.'
      : 'Received under draft contract hp-ii/0.1.0-draft. The connection has not been validated end-to-end.',
  }, 202)
})
