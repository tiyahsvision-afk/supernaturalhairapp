import { describe, expect, it } from 'vitest'
import { prisma } from '@/lib/db'
import { recordProductVersion, upsertProduct, versionAt, findDuplicateProduct } from '@/lib/services/products'
import { makeUser, sourceId, uid } from './fixtures'

describe('products', () => {
  it('preserves label order, versions list changes and resolves the list valid on a past date', async () => {
    const { principal } = await makeUser(['DATA_ADMIN'])
    const src = await sourceId('manufacturer-labels')
    const { product } = await upsertProduct(principal, { brand: 'Test Brand', name: `Order test ${uid()}` })
    const v1 = await recordProductVersion(principal, product.id, { ingredientListRaw: 'Water (Aqua), Glycerin, Butyrospermum Parkii (Shea) Butter, Panthenol', ingredientListSource: 'TEST', sourceId: src, validFrom: new Date('2025-01-01') })
    expect(v1.outcome).toBe('CREATED')
    const lines = await prisma.productIngredient.findMany({ where: { productVersionId: v1.version.id }, orderBy: { position: 'asc' }, include: { ingredient: true } })
    expect(lines.map((l) => l.position)).toEqual([1, 2, 3, 4])
    expect(lines[1].ingredient?.slug).toBe('glycerin')
    expect(lines[2].ingredient?.slug).toMatch(/shea|butyrospermum/i)

    const same = await recordProductVersion(principal, product.id, { ingredientListRaw: 'Water (Aqua),  Glycerin, Butyrospermum Parkii (Shea) Butter, Panthenol', ingredientListSource: 'TEST', sourceId: src })
    expect(same.outcome).toBe('UNCHANGED')

    const v2 = await recordProductVersion(principal, product.id, { ingredientListRaw: 'Water (Aqua), Butyrospermum Parkii (Shea) Butter, Glycerin', ingredientListSource: 'TEST', sourceId: src, validFrom: new Date('2026-06-01') })
    expect(v2.outcome).toBe('CHANGED')
    expect((await versionAt(product.id, new Date('2025-06-01')))?.id).toBe(v1.version.id)
    expect((await versionAt(product.id, new Date('2026-07-01')))?.id).toBe(v2.version.id)
    expect((await prisma.productVersion.findUniqueOrThrow({ where: { id: v1.version.id } })).validTo?.toISOString()).toBe(new Date('2026-06-01').toISOString())
    expect(await prisma.reviewTask.count({ where: { entityType: 'ProductVersion', entityId: v2.version.id } })).toBe(1)
  })

  it('unknown label names are quarantined, not guessed', async () => {
    const { principal } = await makeUser(['DATA_ADMIN'])
    const { product } = await upsertProduct(principal, { brand: 'Test Brand', name: `Unknown ${uid()}` })
    const v = await recordProductVersion(principal, product.id, { ingredientListRaw: 'Water, Zorblax Extract 9000', ingredientListSource: 'TEST' })
    const line = await prisma.productIngredient.findFirstOrThrow({ where: { productVersionId: v.version.id, position: 2 } })
    expect(line.ingredientId).toBeNull()
    expect(line.parsingStatus).toBe('UNMATCHED')
    expect(await prisma.quarantineItem.count({ where: { dedupeKey: `identity:${v.version.id}:2` } })).toBe(1)
  })

  it('detects likely duplicates by barcode or brand + name', async () => {
    const { principal } = await makeUser(['DATA_ADMIN'])
    const name = `Dup ${uid()}`
    await upsertProduct(principal, { brand: 'Dupe Co', name, barcode: '00012345678905' })
    expect((await findDuplicateProduct({ brand: 'dupe co', name: name.toUpperCase() }))?.reason).toBeTruthy()
    expect((await findDuplicateProduct({ brand: 'Other', name: 'Other', barcode: '00012345678905' }))?.reason).toBeTruthy()
  })
})
