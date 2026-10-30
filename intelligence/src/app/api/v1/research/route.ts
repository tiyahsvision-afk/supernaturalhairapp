import { z } from 'zod'
import { ResearchWorkflow } from '@prisma/client'
import { prisma } from '@/lib/db'
import { route, json, pageParams, paginate, ApiError } from '@/lib/api/http'
import { EntitlementError } from '@/lib/entitlements'
import { createProject, projectListWhere, ProjectError } from '@/lib/research/projects'

export const GET = route('research:read', async (ctx) => {
  const { limit, cursor } = pageParams(ctx.req)
  const rows = await prisma.researchProject.findMany({ where: projectListWhere(ctx.principal), orderBy: { id: 'asc' }, take: limit + 1, ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}), select: { id: true, title: true, objective: true, workflow: true, status: true, reviewStatus: true, visibility: true, createdAt: true, updatedAt: true } })
  return json(paginate(rows, limit))
})

const Body = z.object({ title: z.string().min(1).max(200), objective: z.string().max(4000).default(''), workflow: z.nativeEnum(ResearchWorkflow), inputs: z.record(z.string(), z.unknown()) })

export const POST = route('research:write', async (ctx) => {
  const b = Body.parse(await ctx.req.json())
  try {
    const p = await createProject(ctx.principal, { title: b.title, objective: b.objective, workflow: b.workflow, inputs: b.inputs as never })
    const run = await prisma.researchRun.findFirstOrThrow({ where: { projectId: p.id }, orderBy: { createdAt: 'desc' } })
    return json({ data: { id: p.id, workflow: p.workflow, result: run.result }, notice: 'Research decision support only; see result.limitations.' }, 201)
  } catch (e) {
    if (e instanceof EntitlementError) throw new ApiError(402, 'PLAN_LIMIT', e.message)
    if (e instanceof ProjectError) throw new ApiError(422, 'RESEARCH_REJECTED', e.message)
    if (e instanceof Error && /not found|not visible|Choose|Enter|Ask|Provide/.test(e.message)) throw new ApiError(422, 'RESEARCH_REJECTED', e.message)
    throw e
  }
})
