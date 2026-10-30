// Research projects: organization-scoped, with run history, editable objectives, human review, collaboration members
// and immutable report snapshots. No project, run or report is ever readable outside its organization.
import type { Prisma, ResearchWorkflow, Visibility } from '@prisma/client'
import { prisma } from '../db'
import { audit } from '../audit'
import { meter } from '../entitlements'
import { can, type Principal } from '../permissions'
import { requestReview } from '../services/review'
import { runBrief, type BriefInput } from './brief'
import { runClaim, type ClaimInput } from './claim'
import { runCompare, type CompareInput } from './compare'
import { runFormulation, type FormulationInput } from './formulation'
import { runSubstitutes, type SubstituteInput } from './substitutes'
import { runSuppliers, type SupplierInput } from './suppliers'
import { ENGINE_VERSION, type WorkflowResult } from './types'

export class ProjectError extends Error {}

export const WORKFLOWS: Record<ResearchWorkflow, { label: string; short: string; report: string; blurb: string }> = {
  SUBSTITUTES: { label: 'Find ingredient substitutes', short: 'Substitutes', report: 'Ingredient Substitution Research Report', blurb: 'Pick an ingredient and why you want an alternative; get ranked candidates, technical differences, constraints and a test plan.' },
  FORMULATION: { label: 'Research a formulation', short: 'Formulation', report: 'Formulation Research Brief', blurb: 'Paste or select a formula; get identification, compatibility, preservation, regulatory and labelling questions for the lab.' },
  CLAIM: { label: 'Investigate a product claim', short: 'Claim', report: 'Scientific Evidence Review', blurb: 'Enter claim wording; see what is supported, uncertain or unsupported, and what needs regulatory review.' },
  SUPPLIERS: { label: 'Compare suppliers', short: 'Suppliers', report: 'Supplier Comparison Report', blurb: 'Compare raw materials for an ingredient: documentation, grades and stated commercial terms.' },
  COMPARISON: { label: 'Compare ingredients', short: 'Comparison', report: 'Ingredient Comparison Report', blurb: 'Side-by-side technical dimensions with a data status on every value.' },
  PRODUCT_BRIEF: { label: 'Product development brief', short: 'Founder brief', report: 'Product Development Research Blueprint', blurb: 'Answer ten questions about your product; get a structured, evidence-linked research brief.' },
  GENERAL: { label: 'Research question', short: 'Question', report: 'Research Assistant Brief', blurb: 'Ask a question answered from the platform’s own records, with citations.' },
}

type AnyInput = SubstituteInput | FormulationInput | ClaimInput | SupplierInput | CompareInput | BriefInput | { question: string }

export async function execute(principal: Principal, workflow: ResearchWorkflow, input: AnyInput): Promise<{ result: WorkflowResult; aiUsed: boolean; aiModel: string | null }> {
  switch (workflow) {
    case 'SUBSTITUTES': return { result: await runSubstitutes(principal, input as SubstituteInput), aiUsed: false, aiModel: null }
    case 'FORMULATION': return { result: await runFormulation(principal, input as FormulationInput), aiUsed: false, aiModel: null }
    case 'CLAIM': return { result: await runClaim(principal, input as ClaimInput), aiUsed: false, aiModel: null }
    case 'SUPPLIERS': return { result: await runSuppliers(principal, input as SupplierInput), aiUsed: false, aiModel: null }
    case 'COMPARISON': return { result: await runCompare(principal, input as CompareInput), aiUsed: false, aiModel: null }
    case 'PRODUCT_BRIEF': return { result: await runBrief(principal, input as BriefInput), aiUsed: false, aiModel: null }
    case 'GENERAL': {
      const { runAssistant } = await import('./assistant')
      return runAssistant(principal, (input as { question: string }).question)
    }
  }
}

/** Project-level access: same organization; RESTRICTED projects additionally need membership (or being the creator). */
export function canAccessProject(p: Principal, project: { organizationId: string; visibility: Visibility; createdById: string | null; members?: { userId: string; role?: string }[] }, write = false) {
  if (!can(p, write ? 'research:write' : 'research:read')) return false
  if (project.organizationId !== p.organizationId) return false
  if (project.visibility === 'RESTRICTED' || project.visibility === 'CONFIDENTIAL_IP') {
    const member = project.createdById === p.id || (project.members ?? []).some((m) => m.userId === p.id)
    if (!member) return false
  }
  if (write && project.members?.some((m) => m.userId === p.id && m.role === 'VIEWER')) return false
  return true
}

export function projectListWhere(p: Principal): Prisma.ResearchProjectWhereInput {
  return { organizationId: p.organizationId, OR: [{ visibility: { in: ['ORGANIZATION', 'SHARED'] } }, { createdById: p.id }, { members: { some: { userId: p.id } } }] }
}

export async function getProject(p: Principal, id: string, write = false) {
  const project = await prisma.researchProject.findUnique({ where: { id }, include: { members: true, runs: { orderBy: { createdAt: 'desc' } }, reports: { orderBy: { createdAt: 'desc' } } } })
  if (!project || !canAccessProject(p, project, write)) return null
  return project
}

export async function createProject(p: Principal, input: { title: string; objective: string; workflow: ResearchWorkflow; inputs: AnyInput; visibility?: Visibility }) {
  if (!can(p, 'research:write')) throw new ProjectError('Not permitted to create research projects.')
  if (!input.title.trim()) throw new ProjectError('Give the project a title.')
  await meter(p, input.workflow === 'PRODUCT_BRIEF' ? 'wizard' : input.workflow === 'COMPARISON' ? 'compare' : 'research.run', { workflow: input.workflow })
  const { result, aiUsed, aiModel } = await execute(p, input.workflow, input.inputs)
  const project = await prisma.researchProject.create({
    data: {
      organizationId: p.organizationId, createdById: p.kind === 'USER' ? p.id : null, title: input.title.trim().slice(0, 200), objective: input.objective.trim().slice(0, 4000) || result.headline,
      workflow: input.workflow, visibility: input.visibility ?? 'ORGANIZATION', inputs: input.inputs as Prisma.InputJsonValue,
      runs: { create: { workflow: input.workflow, input: input.inputs as Prisma.InputJsonValue, result: result as unknown as Prisma.InputJsonValue, citations: result.citations as unknown as Prisma.InputJsonValue, engineVersion: ENGINE_VERSION, aiUsed, aiModel, createdById: p.kind === 'USER' ? p.id : null } },
    },
  })
  await audit(p, { action: 'research.project.create', entityType: 'ResearchProject', entityId: project.id, after: { workflow: input.workflow, title: project.title } })
  return project
}

export async function rerunProject(p: Principal, id: string, inputs?: AnyInput) {
  const project = await getProject(p, id, true)
  if (!project) throw new ProjectError('Project not found.')
  await meter(p, project.workflow === 'COMPARISON' ? 'compare' : project.workflow === 'PRODUCT_BRIEF' ? 'wizard' : 'research.run', { workflow: project.workflow, rerun: true })
  const use = (inputs ?? project.inputs) as AnyInput
  const { result, aiUsed, aiModel } = await execute(p, project.workflow, use)
  const run = await prisma.researchRun.create({ data: { projectId: id, workflow: project.workflow, input: use as Prisma.InputJsonValue, result: result as unknown as Prisma.InputJsonValue, citations: result.citations as unknown as Prisma.InputJsonValue, engineVersion: ENGINE_VERSION, aiUsed, aiModel, createdById: p.kind === 'USER' ? p.id : null } })
  // New findings invalidate an earlier sign-off.
  await prisma.researchProject.update({ where: { id }, data: { inputs: use as Prisma.InputJsonValue, ...(project.reviewStatus === 'APPROVED' ? { reviewStatus: 'RE_REVIEW_REQUIRED' } : {}) } })
  await audit(p, { action: 'research.project.rerun', entityType: 'ResearchProject', entityId: id, after: { runId: run.id } })
  return run
}

export async function updateProject(p: Principal, id: string, patch: { title?: string; objective?: string; status?: 'OPEN' | 'IN_REVIEW' | 'COMPLETE' | 'ARCHIVED'; visibility?: Visibility }) {
  const project = await getProject(p, id, true)
  if (!project) throw new ProjectError('Project not found.')
  if (patch.visibility && !['ORGANIZATION', 'RESTRICTED'].includes(patch.visibility)) throw new ProjectError('Projects are visible to your organization or restricted to members.')
  const updated = await prisma.researchProject.update({ where: { id }, data: { ...(patch.title ? { title: patch.title.slice(0, 200) } : {}), ...(patch.objective !== undefined ? { objective: patch.objective.slice(0, 4000) } : {}), ...(patch.status ? { status: patch.status } : {}), ...(patch.visibility ? { visibility: patch.visibility } : {}) } })
  await audit(p, { action: 'research.project.update', entityType: 'ResearchProject', entityId: id, before: { title: project.title, objective: project.objective, status: project.status, visibility: project.visibility }, after: patch })
  return updated
}

export async function addMember(p: Principal, id: string, email: string, role: 'EDITOR' | 'VIEWER') {
  const project = await getProject(p, id, true)
  if (!project) throw new ProjectError('Project not found.')
  const user = await prisma.user.findUnique({ where: { email: email.toLowerCase().trim() } })
  // Same answer whether the user does not exist or belongs to another organization (no cross-org enumeration).
  if (!user || user.organizationId !== project.organizationId) throw new ProjectError('No user with that email in your organization.')
  await prisma.researchProjectMember.upsert({ where: { projectId_userId: { projectId: id, userId: user.id } }, update: { role }, create: { projectId: id, userId: user.id, role } })
  await audit(p, { action: 'research.project.member', entityType: 'ResearchProject', entityId: id, after: { userId: user.id, role } })
}

export async function requestProjectReview(p: Principal, id: string, notes?: string) {
  const project = await getProject(p, id, true)
  if (!project) throw new ProjectError('Project not found.')
  const task = await requestReview(p, { entityType: 'ResearchProject', entityId: id, recordType: 'ResearchProject', title: `Research review: ${project.title}`, reviewType: 'EVIDENCE', notes })
  await prisma.researchProject.update({ where: { id }, data: { status: 'IN_REVIEW', reviewStatus: 'SUBMITTED' } })
  return task
}

export function reportTitle(workflow: ResearchWorkflow, title: string) {
  return `${WORKFLOWS[workflow].report}: ${title}`
}

/** Freezes the latest (or a chosen) run into an immutable report snapshot. */
export async function generateReport(p: Principal, id: string, runId?: string) {
  const project = await getProject(p, id)
  if (!project) throw new ProjectError('Project not found.')
  const run = runId ? project.runs.find((r) => r.id === runId) : project.runs[0]
  if (!run) throw new ProjectError('Run the research before generating a report.')
  await meter(p, 'report.generate', { projectId: id })
  const author = p.kind === 'USER' ? await prisma.user.findUnique({ where: { id: p.id }, select: { name: true, email: true } }) : null
  const report = await prisma.researchReport.create({
    data: {
      organizationId: project.organizationId, projectId: id, type: WORKFLOWS[project.workflow].report, title: reportTitle(project.workflow, project.title), createdById: p.kind === 'USER' ? p.id : null,
      snapshot: { objective: project.objective, workflow: project.workflow, projectReviewStatus: project.reviewStatus, runId: run.id, runAt: run.createdAt.toISOString(), engineVersion: run.engineVersion, aiUsed: run.aiUsed, aiModel: run.aiModel, author: author?.name ?? author?.email ?? p.label, result: run.result } as Prisma.InputJsonValue,
    },
  })
  await audit(p, { action: 'research.report.generate', entityType: 'ResearchReport', entityId: report.id, after: { projectId: id, runId: run.id } })
  return report
}

export async function getReport(p: Principal, id: string) {
  const r = await prisma.researchReport.findUnique({ where: { id }, include: { project: { include: { members: true } } } })
  if (!r || r.organizationId !== p.organizationId || !can(p, 'research:read')) return null
  if (r.project && !canAccessProject(p, r.project)) return null
  return r
}
