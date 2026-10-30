import type { IdentityDecision } from '@prisma/client'
import { prisma } from '../db'
import { audit } from '../audit'
import { can, type Principal } from '../permissions'
import { reindexIngredient } from '../search-index'
import { normalizeName, stripParentheticals } from '../normalize'

export class IdentityError extends Error {}

/** Proposes possible duplicates for review. Similar names are NEVER merged automatically. */
export async function proposeDuplicates(limit = 200) {
  // Two distinct EU CosIng entries are by definition different INCI ingredients, so candidates always involve at least
  // one record that is not from CosIng (curated or label-derived). Keeps the query linear in the non-CosIng records.
  const rows = await prisma.$queryRaw<{ a: string; b: string; sim: number; an: string; bn: string }[]>`
    SELECT DISTINCT ON (LEAST(a."ingredientId", b."ingredientId"), GREATEST(a."ingredientId", b."ingredientId"))
      LEAST(a."ingredientId", b."ingredientId") AS a, GREATEST(a."ingredientId", b."ingredientId") AS b,
      similarity(a.normalized, b.normalized) AS sim, a.normalized AS an, b.normalized AS bn
    FROM "IngredientName" a
    JOIN "Ingredient" ia ON ia.id = a."ingredientId" AND ia.status = 'ACTIVE' AND ia."cosingRef" IS NULL
    JOIN "IngredientName" b ON b."ingredientId" <> a."ingredientId" AND a.normalized % b.normalized
    JOIN "Ingredient" ib ON ib.id = b."ingredientId" AND ib.status = 'ACTIVE'
    WHERE similarity(a.normalized, b.normalized) >= 0.55
    ORDER BY LEAST(a."ingredientId", b."ingredientId"), GREATEST(a."ingredientId", b."ingredientId"), sim DESC`
  rows.sort((x, y) => Number(y.sim) - Number(x.sim))
  rows.splice(limit)
  let created = 0
  for (const r of rows) {
    const reason = stripParentheticals(r.an) === stripParentheticals(r.bn) ? `Names identical after removing parentheticals ("${r.an}" / "${r.bn}")` : `Similar names ("${r.an}" / "${r.bn}", similarity ${Number(r.sim).toFixed(2)})`
    const res = await prisma.identityResolutionCandidate.upsert({
      where: { ingredientAId_ingredientBId: { ingredientAId: r.a, ingredientBId: r.b } },
      update: {},
      create: { ingredientAId: r.a, ingredientBId: r.b, reason, score: Number(r.sim) },
    })
    if (res.status === 'OPEN') created++
  }
  return created
}

/**
 * Records a reviewer's decision. Only SAME_INGREDIENT triggers a merge; every merge snapshots the moved rows so it
 * can be reversed by unmerge().
 */
export async function decideCandidate(actor: Principal, candidateId: string, decision: IdentityDecision, notes: string) {
  if (!can(actor, 'ingredient:merge') && decision === 'SAME_INGREDIENT') throw new IdentityError('Merging requires the ingredient:merge permission.')
  if (!can(actor, 'ingredient:approve') && !can(actor, 'ingredient:merge')) throw new IdentityError('Not permitted to decide identity questions.')
  if (!notes?.trim()) throw new IdentityError('A reason is required for every identity decision.')
  const c = await prisma.identityResolutionCandidate.findUniqueOrThrow({ where: { id: candidateId } })
  if (c.status !== 'OPEN') throw new IdentityError('Candidate already decided.')
  if (decision === 'SAME_INGREDIENT') await merge(actor, c.ingredientAId, c.ingredientBId, notes, c.id)
  else if (decision === 'RELATED_INGREDIENT' || decision === 'SALT_OR_DERIVATIVE' || decision === 'MIXTURE_CONTAINING') {
    const relationType = decision === 'SALT_OR_DERIVATIVE' ? 'DERIVATIVE_OF' : decision === 'MIXTURE_CONTAINING' ? 'BLEND_COMPONENT_OF' : 'RELATED_TO'
    await prisma.ingredientRelation.upsert({
      where: { fromId_toId_relationType: { fromId: c.ingredientBId, toId: c.ingredientAId, relationType } },
      update: {},
      create: { fromId: c.ingredientBId, toId: c.ingredientAId, relationType, interchangeable: false, notes, reviewStatus: 'APPROVED' },
    })
    await prisma.identityResolutionEvent.create({ data: { type: 'RELATE', primaryIngredientId: c.ingredientAId, secondaryIngredientId: c.ingredientBId, candidateId, snapshot: { relationType }, reason: notes, actorId: actor.id } })
  } else {
    await prisma.identityResolutionEvent.create({ data: { type: 'DECIDE_DIFFERENT', primaryIngredientId: c.ingredientAId, secondaryIngredientId: c.ingredientBId, candidateId, snapshot: { decision }, reason: notes, actorId: actor.id } })
  }
  await prisma.identityResolutionCandidate.update({ where: { id: candidateId }, data: { status: decision === 'UNRESOLVED' ? 'OPEN' : 'RESOLVED', decision, decidedById: actor.id, decidedAt: new Date(), notes } })
  await audit(actor, { action: 'identity.decide', entityType: 'IdentityResolutionCandidate', entityId: candidateId, after: { decision, notes } })
}

const CHILD_TABLES = ['ingredientName', 'ingredientAlias', 'ingredientIdentifier', 'ingredientFact', 'ingredientFunction', 'concentrationRecord', 'regulatoryRecord', 'safetyReview', 'evidenceLink', 'patentLink', 'productIngredient', 'formulaIngredient', 'rawMaterialComponent'] as const

/** Merges `secondary` into `primary`. Reversible: a full id snapshot of moved rows is stored on the event. */
export async function merge(actor: Principal, primaryId: string, secondaryId: string, reason: string, candidateId?: string) {
  if (primaryId === secondaryId) throw new IdentityError('Cannot merge an ingredient into itself.')
  return prisma.$transaction(async (tx) => {
    const [p, s] = await Promise.all([tx.ingredient.findUniqueOrThrow({ where: { id: primaryId } }), tx.ingredient.findUniqueOrThrow({ where: { id: secondaryId } })])
    if (p.status === 'MERGED' || s.status === 'MERGED') throw new IdentityError('One of the ingredients is already merged.')
    const snapshot: Record<string, string[]> = {}
    for (const t of CHILD_TABLES) {
      // @ts-expect-error dynamic delegate access across child tables that all have ingredientId
      const rows: { id: string }[] = await tx[t].findMany({ where: { ingredientId: secondaryId }, select: { id: true } })
      snapshot[t] = rows.map((r) => r.id)
      for (const id of snapshot[t]) {
        // A failed statement aborts a Postgres transaction, so each move runs under a savepoint that can be rolled back.
        await tx.$executeRawUnsafe('SAVEPOINT merge_move')
        try {
          // @ts-expect-error dynamic delegate
          await tx[t].update({ where: { id }, data: { ingredientId: primaryId } })
          await tx.$executeRawUnsafe('RELEASE SAVEPOINT merge_move')
        } catch {
          // Unique collision (e.g. identical alias already on primary): leave the row on the secondary; not recorded as moved.
          await tx.$executeRawUnsafe('ROLLBACK TO SAVEPOINT merge_move')
          snapshot[t] = snapshot[t].filter((x) => x !== id)
        }
      }
    }
    const alias = normalizeName(s.canonicalName)
    await tx.ingredientAlias.upsert({
      where: { ingredientId_normalized: { ingredientId: primaryId, normalized: alias } },
      update: {},
      create: { ingredientId: primaryId, alias: s.canonicalName, normalized: alias, aliasType: 'LEGACY_NAME', reviewStatus: 'APPROVED' },
    })
    await tx.ingredient.update({ where: { id: secondaryId }, data: { status: 'MERGED', mergedIntoId: primaryId, version: { increment: 1 } } })
    const ev = await tx.identityResolutionEvent.create({ data: { type: 'MERGE', primaryIngredientId: primaryId, secondaryIngredientId: secondaryId, candidateId, snapshot: { moved: snapshot, addedAlias: alias }, reason, actorId: actor.id } })
    await audit(actor, { action: 'identity.merge', entityType: 'Ingredient', entityId: secondaryId, before: { status: s.status }, after: { mergedIntoId: primaryId, eventId: ev.id }, reason }, tx)
    await reindexIngredient(primaryId, tx)
    await reindexIngredient(secondaryId, tx)
    return ev
  }, { timeout: 60_000 })
}

/** Reverses a merge exactly, using the stored snapshot. */
export async function unmerge(actor: Principal, eventId: string, reason: string) {
  if (!can(actor, 'ingredient:merge')) throw new IdentityError('Unmerging requires the ingredient:merge permission.')
  return prisma.$transaction(async (tx) => {
    const ev = await tx.identityResolutionEvent.findUniqueOrThrow({ where: { id: eventId } })
    if (ev.type !== 'MERGE' || ev.reversedAt || !ev.secondaryIngredientId) throw new IdentityError('Event is not a reversible merge.')
    const snap = ev.snapshot as { moved: Record<string, string[]>; addedAlias: string }
    for (const t of CHILD_TABLES) {
      for (const id of snap.moved[t] ?? []) {
        // @ts-expect-error dynamic delegate
        await tx[t].update({ where: { id }, data: { ingredientId: ev.secondaryIngredientId } })
      }
    }
    await tx.ingredientAlias.deleteMany({ where: { ingredientId: ev.primaryIngredientId, normalized: snap.addedAlias, aliasType: 'LEGACY_NAME' } })
    await tx.ingredient.update({ where: { id: ev.secondaryIngredientId }, data: { status: 'ACTIVE', mergedIntoId: null, version: { increment: 1 } } })
    await tx.identityResolutionEvent.update({ where: { id: eventId }, data: { reversedAt: new Date(), reversedById: actor.id } })
    await tx.identityResolutionEvent.create({ data: { type: 'UNMERGE', primaryIngredientId: ev.primaryIngredientId, secondaryIngredientId: ev.secondaryIngredientId, snapshot: { reverses: eventId }, reason, actorId: actor.id } })
    await audit(actor, { action: 'identity.unmerge', entityType: 'Ingredient', entityId: ev.secondaryIngredientId, after: { status: 'ACTIVE', reverses: eventId }, reason }, tx)
    await reindexIngredient(ev.primaryIngredientId, tx)
    await reindexIngredient(ev.secondaryIngredientId, tx)
  }, { timeout: 60_000 })
}
