import { createHash } from 'node:crypto'
import type { ApplicationType, Prisma } from '@prisma/client'
import { prisma } from '../db'
import { audit } from '../audit'
import type { Principal } from '../permissions'
import { parseIngredientList } from '../inci-parser'
import { buildNameIndex, matchItems, type NameIndex } from './matching'
import { screenClaimText } from '../claims-guard'
import { upsertEdge } from './graph'
import { requestReview } from './review'
import { reindexProduct } from '../search-index'
import { normalizeName, slugify } from '../normalize'

export function listHash(raw: string): string {
  const items = parseIngredientList(raw).items.map((i) => i.normalizedName)
  return createHash('sha256').update(items.join('|')).digest('hex')
}

export interface ProductInput {
  slug?: string
  brand: string
  name: string
  category?: string
  market?: string
  applicationType?: ApplicationType
  isSupernatural?: boolean
  barcode?: string | null
  purchaseUrl?: string | null
  ownerOrgId?: string | null
}

export async function findDuplicateProduct(input: { brand: string; name: string; barcode?: string | null }) {
  if (input.barcode) {
    const byBarcode = await prisma.product.findFirst({ where: { barcode: input.barcode } })
    if (byBarcode) return { product: byBarcode, reason: 'Same barcode' }
  }
  const all = await prisma.product.findMany({ where: { brand: { equals: input.brand, mode: 'insensitive' } } })
  const n = normalizeName(input.name)
  const hit = all.find((p) => normalizeName(p.name) === n)
  return hit ? { product: hit, reason: 'Same brand and name' } : null
}

export async function upsertProduct(actor: Principal | null, input: ProductInput) {
  const slug = input.slug ?? slugify(`${input.brand} ${input.name}`)
  const existing = await prisma.product.findUnique({ where: { slug } })
  const data = { brand: input.brand, name: input.name, category: input.category, market: input.market, applicationType: input.applicationType ?? 'UNKNOWN', isSupernatural: input.isSupernatural ?? false, barcode: input.barcode ?? null, purchaseUrl: input.purchaseUrl ?? null, ownerOrgId: input.ownerOrgId ?? null }
  const product = existing ? await prisma.product.update({ where: { slug }, data }) : await prisma.product.create({ data: { slug, ...data } })
  if (!existing) await audit(actor, { action: 'product.create', entityType: 'Product', entityId: product.id, after: data })
  await reindexProduct(product.id)
  return { product, created: !existing }
}

export interface VersionInput {
  ingredientListRaw: string
  ingredientListSource: string
  sourceUrl?: string | null
  sourceId?: string | null
  validFrom?: Date
  marketingExcerpts?: string[]
  dataQualityNotes?: string[]
}

/**
 * Records a product ingredient list. Identical list ⇒ unchanged. Changed list ⇒ new version; the previous version is
 * closed (validTo) but kept, so exposure for earlier dates still resolves to the earlier list.
 */
export async function recordProductVersion(actor: Principal | null, productId: string, v: VersionInput, nameIndex?: NameIndex) {
  const hash = listHash(v.ingredientListRaw)
  const current = await prisma.productVersion.findFirst({ where: { productId, validTo: null }, orderBy: { versionNumber: 'desc' } })
  if (current && current.contentHash === hash) return { version: current, outcome: 'UNCHANGED' as const }
  const validFrom = v.validFrom ?? new Date()
  const parsed = parseIngredientList(v.ingredientListRaw)
  const matched = await matchItems(parsed.items, nameIndex ?? (await buildNameIndex()))
  const claimFlags = (v.marketingExcerpts ?? []).flatMap((t) => screenClaimText(t))
  const version = await prisma.$transaction(async (tx) => {
    if (current) await tx.productVersion.update({ where: { id: current.id }, data: { validTo: validFrom } })
    const created = await tx.productVersion.create({
      data: {
        productId, versionNumber: (current?.versionNumber ?? 0) + 1, ingredientListRaw: v.ingredientListRaw, ingredientListSource: v.ingredientListSource,
        sourceUrl: v.sourceUrl, sourceId: v.sourceId ?? null, contentHash: hash, validFrom, marketingExcerpts: v.marketingExcerpts ?? [],
        claimFlags: claimFlags as unknown as Prisma.InputJsonValue, dataQualityNotes: [...(v.dataQualityNotes ?? []), ...parsed.removedNotes.map((n) => `Removed footnote: ${n}`)],
        lines: {
          create: matched.map((m) => ({
            position: m.position, displayedName: m.displayedName, normalizedName: m.normalizedName, ingredientId: m.ingredientId,
            identityConfidence: m.confidence, matchMethod: m.method, parsingStatus: m.status,
          })),
        },
      },
    })
    await audit(actor, { action: current ? 'product.version.change_detected' : 'product.version.create', entityType: 'ProductVersion', entityId: created.id, before: current ? { versionNumber: current.versionNumber, contentHash: current.contentHash } : undefined, after: { versionNumber: created.versionNumber, contentHash: hash }, sourceId: v.sourceId ?? null }, tx)
    for (const m of matched) {
      if (m.status !== 'MATCHED') {
        await tx.quarantineItem.upsert({
          where: { dedupeKey: `identity:${created.id}:${m.position}` },
          update: {},
          create: { queue: 'UNRESOLVED_IDENTITY', entityType: 'ProductIngredient', entityId: `${created.id}#${m.position}`, dedupeKey: `identity:${created.id}:${m.position}`, payload: { displayedName: m.displayedName, candidates: m.candidates, confidence: m.confidence, method: m.method, productId }, reason: m.status === 'UNMATCHED' ? `No canonical ingredient matches "${m.displayedName}".` : `Ambiguous identity for "${m.displayedName}" (confidence ${m.confidence}).` },
        })
      }
      if (m.ingredientId) {
        await upsertEdge(actor, { fromType: 'Product', fromId: productId, toType: 'Ingredient', toId: m.ingredientId, edgeType: 'CONTAINS', sourceId: v.sourceId ?? null, confidence: Math.min(1, m.confidence), evidenceType: 'MANUFACTURER_LABEL', properties: { position: m.position, displayedName: m.displayedName, productVersion: created.versionNumber } }, tx)
      }
    }
    if (current) await requestReview(actor, { entityType: 'ProductVersion', entityId: created.id, title: `Ingredient-list change detected (v${current.versionNumber} → v${created.versionNumber})`, reviewType: 'PRODUCT_INGREDIENTS', priority: 'HIGH' }, tx)
    return created
  }, { timeout: 120_000 })
  return { version, outcome: current ? ('CHANGED' as const) : ('CREATED' as const) }
}

/** The ingredient-list version that applied on a given date (used for exposure; never rewrites history). */
export async function versionAt(productId: string, at: Date) {
  return prisma.productVersion.findFirst({ where: { productId, validFrom: { lte: at }, OR: [{ validTo: null }, { validTo: { gt: at } }] }, orderBy: { versionNumber: 'desc' } })
}
