'use server'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import type { AliasType, ConcentrationType, IdentifierType, IdentityType, MaterialType, OriginType, PropertyType, RegulatoryStatus } from '@prisma/client'
import { prisma } from '@/lib/db'
import { requirePermission } from '@/lib/auth/next'
import { addAlias, addIdentifier, createIngredient, IngredientError, updateIngredient } from '@/lib/services/ingredients'
import { createFact, supersedeFact } from '@/lib/services/facts'
import { requestReview } from '@/lib/services/review'
import { audit } from '@/lib/audit'

const s = (f: FormData, k: string) => String(f.get(k) ?? '').trim()

export async function createIngredientAction(_p: { error?: string; existingId?: string } | undefined, f: FormData) {
  const sess = await requirePermission('ingredient:write', 'create ingredient')
  const manual = await prisma.source.findUniqueOrThrow({ where: { key: 'curator-seed' } })
  const sourceKey = s(f, 'sourceKey') || 'curator-seed'
  const source = (await prisma.source.findUnique({ where: { key: sourceKey } })) ?? manual
  let id: string
  try {
    const ing = await createIngredient(sess.principal, {
      canonicalName: s(f, 'canonicalName'), inciName: s(f, 'inciName') || null, commonName: s(f, 'commonName') || null, chemicalName: s(f, 'chemicalName') || null,
      description: s(f, 'description') || null, identityType: s(f, 'identityType') as IdentityType, materialType: s(f, 'materialType') as MaterialType,
      originType: (s(f, 'originType') || 'UNKNOWN') as OriginType, familySlug: s(f, 'family') || null,
      aliases: s(f, 'aliases').split(/[;\n]/).map((a) => a.trim()).filter(Boolean).map((alias) => ({ alias })), sourceId: source.id,
    })
    id = ing.id
  } catch (e) {
    if (e instanceof IngredientError) return { error: e.message, existingId: e.existingId }
    throw e
  }
  redirect(`/ingredients/${id}`)
}

export async function updateIngredientAction(f: FormData) {
  const sess = await requirePermission('ingredient:write', 'update ingredient')
  const id = s(f, 'id')
  await updateIngredient(sess.principal, id, { displayName: s(f, 'displayName') || undefined, commonName: s(f, 'commonName') || null, chemicalName: s(f, 'chemicalName') || null, description: s(f, 'description') || null, identityNote: s(f, 'identityNote') || null }, s(f, 'reason'))
  revalidatePath(`/ingredients/${id}`)
}

export async function addAliasAction(f: FormData) {
  const sess = await requirePermission('ingredient:write', 'add alias')
  const id = s(f, 'id')
  await addAlias(sess.principal, id, s(f, 'alias'), (s(f, 'aliasType') || 'SYNONYM') as AliasType)
  revalidatePath(`/ingredients/${id}`)
}

export async function addIdentifierAction(f: FormData) {
  const sess = await requirePermission('ingredient:write', 'add identifier')
  const id = s(f, 'id')
  const src = await prisma.source.findUnique({ where: { key: s(f, 'sourceKey') || 'curator-seed' } })
  await addIdentifier(sess.principal, { ingredientId: id, type: s(f, 'type') as IdentifierType, value: s(f, 'value'), sourceId: src?.id, sourceLocation: s(f, 'sourceLocation') || undefined, verificationStatus: 'UNVERIFIED' })
  revalidatePath(`/ingredients/${id}`)
  redirect(`/ingredients/${id}?tab=identity`)
}

export async function addFactAction(f: FormData) {
  const sess = await requirePermission('fact:write', 'add fact')
  const id = s(f, 'id')
  const sourceId = s(f, 'sourceId')
  if (!sourceId) throw new Error('A source is required for every fact.')
  const input = { ingredientId: id, propertyType: s(f, 'propertyType') as PropertyType, value: s(f, 'value'), unit: s(f, 'unit') || null, sourceId, sourceLocation: s(f, 'sourceLocation') || undefined, entryMode: 'MANUAL' as const, testConditions: s(f, 'testConditions') || undefined, medium: s(f, 'medium') || undefined, quotedText: s(f, 'quotedText') || undefined }
  const supersedes = s(f, 'supersedes')
  const fact = supersedes ? await supersedeFact(sess.principal, supersedes, input, s(f, 'reason') || 'Correction') : await createFact(sess.principal, input)
  await requestReview(sess.principal, { entityType: 'IngredientFact', entityId: fact.id, title: `Property review: ${input.propertyType}` })
  revalidatePath(`/ingredients/${id}`)
  redirect(`/ingredients/${id}?tab=properties`)
}

export async function addConcentrationAction(f: FormData) {
  const sess = await requirePermission('fact:write', 'add concentration')
  const id = s(f, 'id')
  const num = (k: string) => (s(f, k) ? Number(s(f, k)) : null)
  const rec = await prisma.concentrationRecord.create({ data: { ingredientId: id, recordType: s(f, 'recordType') as ConcentrationType, minValue: num('min'), maxValue: num('max'), typicalValue: num('typical'), unit: s(f, 'unit') || '% w/w', basis: s(f, 'basis') || 'UNKNOWN', productCategory: s(f, 'productCategory') || null, applicationType: (s(f, 'applicationType') || 'UNKNOWN') as never, sourceId: s(f, 'sourceId'), sourceLocation: s(f, 'sourceLocation') || null, jurisdiction: s(f, 'jurisdiction') || null, entryMode: 'MANUAL' } })
  await audit(sess.principal, { action: 'concentration.create', entityType: 'ConcentrationRecord', entityId: rec.id, after: rec })
  revalidatePath(`/ingredients/${id}`)
  redirect(`/ingredients/${id}?tab=concentrations`)
}

export async function addRegulatoryAction(f: FormData) {
  const sess = await requirePermission('regulatory:write', 'add regulatory record')
  const id = s(f, 'id')
  const max = s(f, 'max') ? Number(s(f, 'max')) : null
  const rec = await prisma.regulatoryRecord.create({ data: { ingredientId: id, jurisdiction: s(f, 'jurisdiction').toUpperCase(), authority: s(f, 'authority'), regulationRef: s(f, 'regulationRef') || null, status: s(f, 'status') as RegulatoryStatus, maxConcentration: max, maxConcentrationUnit: s(f, 'unit') || null, productRestrictions: s(f, 'restrictions') || null, warningRequirements: s(f, 'warnings') || null, sourceId: s(f, 'sourceId'), sourceUrl: s(f, 'sourceUrl') || null, lastCheckedAt: s(f, 'checked') ? new Date(s(f, 'checked')) : null, effectiveDate: s(f, 'effective') ? new Date(s(f, 'effective')) : null, entryMode: 'MANUAL' } })
  await audit(sess.principal, { action: 'regulatory.create', entityType: 'RegulatoryRecord', entityId: rec.id, after: rec, sourceId: rec.sourceId })
  await requestReview(sess.principal, { entityType: 'RegulatoryRecord', entityId: rec.id, title: `Regulatory review: ${rec.jurisdiction}` })
  revalidatePath(`/ingredients/${id}`)
  redirect(`/ingredients/${id}?tab=regulatory`)
}

export async function addFunctionAction(f: FormData) {
  const sess = await requirePermission('ingredient:write', 'add function')
  const id = s(f, 'id')
  const fn = await prisma.functionTerm.findUniqueOrThrow({ where: { code: s(f, 'code') } })
  const row = await prisma.ingredientFunction.upsert({ where: { ingredientId_functionId_sourceId: { ingredientId: id, functionId: fn.id, sourceId: s(f, 'sourceId') } }, update: {}, create: { ingredientId: id, functionId: fn.id, sourceId: s(f, 'sourceId'), basis: s(f, 'basis') || 'SOURCE_DECLARED', entryMode: 'MANUAL' } })
  await audit(sess.principal, { action: 'function.add', entityType: 'IngredientFunction', entityId: row.id, after: { code: fn.code } })
  revalidatePath(`/ingredients/${id}`)
  redirect(`/ingredients/${id}?tab=functions`)
}
