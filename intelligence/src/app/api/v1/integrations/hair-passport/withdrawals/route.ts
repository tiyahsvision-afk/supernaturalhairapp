import { route, json, ApiError } from '@/lib/api/http'
import { processWithdrawal } from '@/lib/integration/hair-passport'

export const POST = route('integration:manage', async (ctx) => {
  const body = await ctx.req.json()
  const result = await processWithdrawal(ctx.principal, body).catch((e: Error) => { throw new ApiError(422, 'WITHDRAWAL_REJECTED', e.message) })
  return json({ data: result }, 202)
})
