import { prisma } from '@/lib/db'
import { route, json } from '@/lib/api/http'

/** Confidential research candidates. Always restricted to the caller's own organization. */
export const GET = route('ip:read', async (ctx) => {
  const rows = await prisma.researchCandidate.findMany({ where: { ownerOrgId: ctx.principal.organizationId }, orderBy: { code: 'asc' } })
  return json({ data: rows, notice: 'Confidential. Research hypotheses only — not validated, not cleared for use, not a patentability or ownership determination.' })
})
