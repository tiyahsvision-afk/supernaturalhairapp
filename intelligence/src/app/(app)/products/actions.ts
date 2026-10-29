'use server'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/db'
import { requirePermission } from '@/lib/auth/next'
import { findDuplicateProduct, recordProductVersion, upsertProduct } from '@/lib/services/products'
import { upsertEdge } from '@/lib/services/graph'
import { audit } from '@/lib/audit'

export async function createProductAction(_p: { error?: string; duplicateId?: string } | undefined, f: FormData) {
  const s = await requirePermission('product:write', 'create product')
  const brand = String(f.get('brand') ?? '').trim(), name = String(f.get('name') ?? '').trim(), list = String(f.get('ingredientList') ?? '').trim()
  if (!brand || !name || !list) return { error: 'Brand, name and ingredient list are required.' }
  const barcode = String(f.get('barcode') ?? '').trim() || null
  if (barcode && !/^\d{8,14}$/.test(barcode)) return { error: 'Barcode must be 8–14 digits (GTIN).' }
  if (f.get('confirmNotDuplicate') !== '1') {
    const dup = await findDuplicateProduct({ brand, name, barcode })
    if (dup) return { error: `Possible duplicate: ${dup.product.brand} — ${dup.product.name} (${dup.reason}). Open it to add a new ingredient-list version, or tick “not a duplicate”.`, duplicateId: dup.product.id }
  }
  const src = await prisma.source.findUniqueOrThrow({ where: { key: String(f.get('sourceKey') || 'manufacturer-labels') } })
  const { product } = await upsertProduct(s.principal, { brand, name, category: String(f.get('category') ?? '') || undefined, market: String(f.get('market') ?? '') || undefined, applicationType: (String(f.get('applicationType') || 'UNKNOWN')) as never, barcode, purchaseUrl: String(f.get('url') ?? '') || null })
  await recordProductVersion(s.principal, product.id, { ingredientListRaw: list, ingredientListSource: String(f.get('listSource') || 'MANUFACTURER_WEBSITE'), sourceUrl: String(f.get('url') ?? '') || null, sourceId: src.id })
  redirect(`/products/${product.id}`)
}

export async function addVersionAction(f: FormData) {
  const s = await requirePermission('product:write', 'product version')
  const id = String(f.get('productId'))
  const src = await prisma.source.findUniqueOrThrow({ where: { key: String(f.get('sourceKey') || 'manufacturer-labels') } })
  await recordProductVersion(s.principal, id, { ingredientListRaw: String(f.get('ingredientList')), ingredientListSource: String(f.get('listSource') || 'MANUFACTURER_WEBSITE'), sourceUrl: String(f.get('url') ?? '') || null, sourceId: src.id, validFrom: f.get('validFrom') ? new Date(String(f.get('validFrom'))) : undefined })
  revalidatePath(`/products/${id}`)
}

/** Manual identity correction of one label line. Preserves the previous mapping in the audit log. */
export async function linkLineAction(f: FormData) {
  const s = await requirePermission('product:write', 'product line identity')
  const lineId = String(f.get('lineId')), ingredientId = String(f.get('ingredientId') ?? '').replace(/^ing:/, '')
  const line = await prisma.productIngredient.findUniqueOrThrow({ where: { id: lineId }, include: { productVersion: true } })
  const ing = await prisma.ingredient.findUnique({ where: { id: ingredientId } })
  if (!ing) throw new Error('Choose an ingredient from the list.')
  await prisma.productIngredient.update({ where: { id: lineId }, data: { ingredientId: ing.id, identityConfidence: 1, matchMethod: 'MANUAL', parsingStatus: 'MATCHED', verificationStatus: 'VERIFIED' } })
  await audit(s.principal, { action: 'product.line.identity', entityType: 'ProductIngredient', entityId: lineId, before: { ingredientId: line.ingredientId, confidence: line.identityConfidence, method: line.matchMethod }, after: { ingredientId: ing.id }, reason: String(f.get('reason') || 'Manual identity correction') })
  await upsertEdge(s.principal, { fromType: 'Product', fromId: line.productVersion.productId, toType: 'Ingredient', toId: ing.id, edgeType: 'CONTAINS', confidence: 1, evidenceType: 'MANUAL_VERIFICATION', properties: { position: line.position } })
  await prisma.quarantineItem.updateMany({ where: { dedupeKey: `identity:${line.productVersionId}:${line.position}`, status: 'OPEN' }, data: { status: 'RESOLVED', resolvedById: s.user.id, resolvedAt: new Date(), resolution: `Linked to ${ing.canonicalName}` } })
  revalidatePath(`/products/${line.productVersion.productId}`)
}
