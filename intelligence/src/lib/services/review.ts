import type { Prisma, ReviewStatus, ReviewType, Role } from '@prisma/client'
import { prisma } from '../db'
import { audit } from '../audit'
import type { Principal } from '../permissions'

type Tx = Prisma.TransactionClient | typeof prisma

export class ReviewError extends Error {}

/** Creates a review task using the configured requirement for the record type (roles, approvals, blind, due date). */
export async function requestReview(actor: Principal | null, input: { entityType: string; entityId: string; title: string; recordType?: string; reviewType?: ReviewType; priority?: 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT'; notes?: string }, tx: Tx = prisma) {
  const req = await tx.reviewRequirement.findUnique({ where: { recordType: input.recordType ?? input.entityType } })
  const open = await tx.reviewTask.findFirst({ where: { entityType: input.entityType, entityId: input.entityId, status: { in: ['SUBMITTED', 'ASSIGNED', 'UNDER_REVIEW', 'SECOND_REVIEW_REQUIRED'] } } })
  if (open) return open
  const task = await tx.reviewTask.create({
    data: {
      entityType: input.entityType,
      entityId: input.entityId,
      title: input.title,
      reviewType: req?.reviewType ?? input.reviewType ?? 'IDENTITY',
      requiredRoles: req?.requiredRoles ?? ['DATA_ADMIN'],
      approvalsRequired: req ? req.approvalsRequired + (req.secondReviewer ? 1 : 0) : 1,
      blind: req?.blind ?? false,
      priority: input.priority ?? 'NORMAL',
      dueAt: new Date(Date.now() + (req?.dueInDays ?? 14) * 86400_000),
      submittedById: actor?.kind === 'USER' ? actor.id : null,
      notes: input.notes,
    },
  })
  await audit(actor, { action: 'review.request', entityType: 'ReviewTask', entityId: task.id, after: { entityType: input.entityType, entityId: input.entityId } }, tx)
  return task
}

/**
 * Review tasks about organization-owned records (research projects, formula versions) are only listed for, and can
 * only be decided by, members of the owning organization. Tasks about shared reference data are visible to all.
 */
export async function taskVisibilityWhere(p: Principal): Promise<Prisma.ReviewTaskWhereInput> {
  const [projects, versions] = await Promise.all([
    prisma.researchProject.findMany({ where: { organizationId: p.organizationId }, select: { id: true } }),
    prisma.formulaVersion.findMany({ where: { formula: { ownerOrgId: p.organizationId } }, select: { id: true } }),
  ])
  return { AND: [
    { OR: [{ entityType: { not: 'ResearchProject' } }, { entityId: { in: projects.map((x) => x.id) } }] },
    { OR: [{ entityType: { not: 'FormulaVersion' } }, { entityId: { in: versions.map((x) => x.id) } }] },
  ] }
}

async function assertTaskInOrg(tx: Prisma.TransactionClient, actor: Principal, task: { entityType: string; entityId: string }) {
  if (task.entityType === 'ResearchProject') {
    const pr = await tx.researchProject.findUnique({ where: { id: task.entityId }, select: { organizationId: true } })
    if (!pr || pr.organizationId !== actor.organizationId) throw new ReviewError('Task not found.')
  }
  if (task.entityType === 'FormulaVersion') {
    const fv = await tx.formulaVersion.findUnique({ where: { id: task.entityId }, select: { formula: { select: { ownerOrgId: true } } } })
    if (!fv || fv.formula.ownerOrgId !== actor.organizationId) throw new ReviewError('Task not found.')
  }
}

export function eligibleReviewer(roles: Role[], required: Role[]): boolean {
  return roles.includes('SUPER_ADMIN') || roles.some((r) => required.includes(r))
}

/**
 * Records a decision. Enforces: qualified role, no self-approval of own submission, distinct reviewers for multi-approval
 * tasks, and blind review (decisions of other reviewers are not shown — see getTaskForReviewer).
 */
export async function decide(actor: Principal, taskId: string, decision: Extract<ReviewStatus, 'APPROVED' | 'REJECTED' | 'CHANGES_REQUESTED'>, notes: string) {
  if (actor.kind !== 'USER') throw new ReviewError('Reviews require a signed-in reviewer.')
  return prisma.$transaction(async (tx) => {
    const task = await tx.reviewTask.findUniqueOrThrow({ where: { id: taskId }, include: { decisions: true } })
    await assertTaskInOrg(tx, actor, task)
    if (['APPROVED', 'REJECTED', 'SUPERSEDED', 'EXPIRED'].includes(task.status)) throw new ReviewError('Task already closed.')
    if (!eligibleReviewer(actor.roles, task.requiredRoles)) throw new ReviewError(`Requires one of: ${task.requiredRoles.join(', ')}`)
    if (task.submittedById === actor.id) throw new ReviewError('Reviewers cannot approve their own submission.')
    if (task.decisions.some((d) => d.reviewerId === actor.id)) throw new ReviewError('You have already recorded a decision on this task.')
    if (decision !== 'APPROVED' && !notes?.trim()) throw new ReviewError('A reason is required when rejecting or requesting changes.')
    await tx.reviewDecision.create({ data: { taskId, reviewerId: actor.id, decision, notes } })
    const status = nextReviewStatus(task.decisions.map((d) => d.decision), decision, task.approvalsRequired)
    const updated = await tx.reviewTask.update({ where: { id: taskId }, data: { status, completedAt: ['APPROVED', 'REJECTED'].includes(status) ? new Date() : null } })
    if (status === 'APPROVED' || status === 'REJECTED') await applyOutcome(tx, actor, task.entityType, task.entityId, status)
    await audit(actor, { action: 'review.decide', entityType: 'ReviewTask', entityId: taskId, before: { status: task.status }, after: { status, decision }, reason: notes }, tx)
    return updated
  })
}

/**
 * Pure state machine for review outcomes.
 *  - CHANGES_REQUESTED returns the record to its author.
 *  - Without disagreement: a rejection rejects; approvals finalize once `approvalsRequired` distinct approvals exist.
 *  - With disagreement among reviewers: SECOND_REVIEW_REQUIRED until an additional (adjudicating) reviewer decides;
 *    the adjudicator's decision is final.
 */
export function nextReviewStatus(prior: ReviewStatus[], decision: 'APPROVED' | 'REJECTED' | 'CHANGES_REQUESTED', approvalsRequired: number): ReviewStatus {
  if (decision === 'CHANGES_REQUESTED') return 'CHANGES_REQUESTED'
  const priorFinal = prior.filter((d) => d === 'APPROVED' || d === 'REJECTED')
  const disagreementBefore = new Set(priorFinal).size > 1
  if (disagreementBefore) return decision // adjudicator decides
  if (priorFinal.length && priorFinal[0] !== decision) return 'SECOND_REVIEW_REQUIRED'
  if (decision === 'REJECTED') return 'REJECTED'
  return priorFinal.length + 1 >= approvalsRequired ? 'APPROVED' : 'SECOND_REVIEW_REQUIRED'
}

const ENTITY_DELEGATE: Record<string, string> = {
  Ingredient: 'ingredient', IngredientFact: 'ingredientFact', RegulatoryRecord: 'regulatoryRecord', SafetyReview: 'safetyReview',
  Evidence: 'evidence', Patent: 'patent', GraphEdge: 'graphEdge', ProductVersion: 'productVersion', IngredientFunction: 'ingredientFunction',
  IngredientIdentifier: 'ingredientIdentifier', Source: 'source', EvidenceLink: 'evidenceLink', ResearchProject: 'researchProject',
}

/** Propagates an approved/rejected review onto the reviewed record (never onto AI drafts without a human decision). */
async function applyOutcome(tx: Prisma.TransactionClient, actor: Principal, entityType: string, entityId: string, status: 'APPROVED' | 'REJECTED') {
  const delegate = ENTITY_DELEGATE[entityType]
  if (entityType === 'FormulaVersion') {
    await tx.formulaVersion.update({ where: { id: entityId }, data: { chemistReviewStatus: status, ...(status === 'APPROVED' ? { approvedById: actor.id } : {}) } })
    return
  }
  if (entityType === 'Source') {
    await tx.source.update({ where: { id: entityId }, data: { termsReviewStatus: status, lastTermsReviewAt: new Date(), reviewedById: actor.id } })
    return
  }
  if (!delegate) return
  const data: Record<string, unknown> = { reviewStatus: status }
  if (['ingredientFact', 'evidence', 'regulatoryRecord'].includes(delegate)) Object.assign(data, { reviewedById: actor.id, reviewedAt: new Date() })
  if (delegate === 'graphEdge') data.status = status === 'APPROVED' ? 'ACTIVE' : 'DEPRECATED'
  // @ts-expect-error dynamic delegate by entity type
  await tx[delegate].update({ where: { id: entityId }, data })
}
