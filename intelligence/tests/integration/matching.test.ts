import { describe, expect, it } from 'vitest'
import { prisma } from '@/lib/db'
import { buildNameIndex, matchName } from '@/lib/services/matching'
import { merge, unmerge } from '@/lib/services/identity'
import { makeUser, uid } from './fixtures'

describe('label name matching', () => {
  it('accepts deterministic label variants only when exactly one ingredient fits', async () => {
    const idx = await buildNameIndex()
    const inci = async (id: string | null) => (id ? (await prisma.ingredient.findUniqueOrThrow({ where: { id } })).inciName : null)
    const cases: [string, string][] = [
      ['Rosmarinus Officinalis (Rosemary) Leaf Extract', 'Rosmarinus Officinalis Leaf Extract'],
      ['Water/Aqua/Eau', 'Aqua'],
      ['Water', 'Aqua'],
      ['Polysorbate-20', 'Polysorbate 20'],
      ['Hydroxyethyl Cellulose', 'Hydroxyethylcellulose'],
      ['Blue 1 (CI 42090)', 'CI 42090'],
    ]
    for (const [label, expected] of cases) {
      const m = matchName(idx, label)
      expect(m.status, label).toBe('MATCHED')
      expect(await inci(m.ingredientId), label).toBe(expected)
    }
    // Common names, blends and misspellings still go to identity review.
    for (const label of ['Burdock', 'behenetrimonium methosulfate and cetearyl alcohol (BTMS)', 'Simmendsia Chinensis (Jojoba) Seed Oil']) expect(matchName(idx, label).status, label).not.toBe('MATCHED')
  })

  it('WATER is merged into AQUA, reversibly', async () => {
    const water = await prisma.ingredient.findFirstOrThrow({ where: { cosingRef: '92472' } })
    const aqua = await prisma.ingredient.findFirstOrThrow({ where: { cosingRef: '31959' } })
    expect(water.status).toBe('MERGED')
    expect(water.mergedIntoId).toBe(aqua.id)
    expect(await prisma.identityResolutionEvent.count({ where: { type: 'MERGE', secondaryIngredientId: water.id, reversedAt: null } })).toBe(1)
  })
})

describe('identity merge', () => {
  it('survives colliding child rows and unmerges exactly', async () => {
    const { principal } = await makeUser(['DATA_ADMIN'])
    const mk = (n: string) => prisma.ingredient.create({ data: { slug: `merge-${n}-${uid()}`, canonicalName: `Merge Test ${n} ${uid()}`, displayName: `Merge Test ${n}`, identityType: 'DEFINED_SUBSTANCE', materialType: 'OTHER', originType: 'UNKNOWN' } })
    const [a, b] = [await mk('a'), await mk('b')]
    // Same alias on both: moving b's alias would violate (ingredientId, normalized) uniqueness.
    for (const i of [a, b]) await prisma.ingredientAlias.create({ data: { ingredientId: i.id, alias: 'Shared Label Name', normalized: 'shared label name', aliasType: 'SYNONYM' } })
    await prisma.ingredientAlias.create({ data: { ingredientId: b.id, alias: 'Only On B', normalized: 'only on b', aliasType: 'SYNONYM' } })
    const ev = await merge(principal, a.id, b.id, 'test')
    expect((await prisma.ingredient.findUniqueOrThrow({ where: { id: b.id } })).status).toBe('MERGED')
    expect(await prisma.ingredientAlias.count({ where: { ingredientId: a.id, normalized: 'only on b' } })).toBe(1)
    expect(await prisma.ingredientAlias.count({ where: { ingredientId: b.id, normalized: 'shared label name' } })).toBe(1)
    await unmerge(principal, ev.id, 'test')
    expect((await prisma.ingredient.findUniqueOrThrow({ where: { id: b.id } })).status).toBe('ACTIVE')
    expect(await prisma.ingredientAlias.count({ where: { ingredientId: b.id, normalized: 'only on b' } })).toBe(1)
  })
})
