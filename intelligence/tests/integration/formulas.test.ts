import { describe, expect, it } from 'vitest'
import { prisma } from '@/lib/db'
import { createFormula, newVersion, setStatus, FormulaError, summarizeVersion } from '@/lib/services/formulas'
import { decide } from '@/lib/services/review'
import { makeUser, uid, ingredientBySlug } from './fixtures'

describe('formulas', () => {
  it('validates totals: q.s. fills to 100 and over-100% is invalid', async () => {
    const { principal } = await makeUser(['COSMETIC_CHEMIST'])
    const gly = await ingredientBySlug('glycerin')
    const ok = await createFormula(principal, { code: `F-${uid()}`, name: 'qs', lines: [{ displayName: 'Water', ingredientId: (await ingredientBySlug('water')).id, isQs: true }, { displayName: 'Glycerin', ingredientId: gly.id, percent: 5 }] })
    expect(ok.validation.valid).toBe(true)
    const water = await prisma.formulaIngredient.findFirstOrThrow({ where: { formulaVersionId: ok.version.id, isQs: true } })
    expect(Number(water.percent)).toBe(95)
    const bad = await createFormula(principal, { code: `F-${uid()}`, name: 'over', lines: [{ displayName: 'Glycerin', ingredientId: gly.id, percent: 60 }, { displayName: 'Glycerin 2', ingredientId: gly.id, percent: 50 }] })
    expect(bad.validation.valid).toBe(false)
  })

  it('a new version locks the previous one and leaves its lines unchanged', async () => {
    const { principal } = await makeUser(['COSMETIC_CHEMIST'])
    const gly = await ingredientBySlug('glycerin')
    const f = await createFormula(principal, { code: `F-${uid()}`, name: 'versions', lines: [{ displayName: 'Water', ingredientId: (await ingredientBySlug('water')).id, isQs: true }, { displayName: 'Glycerin', ingredientId: gly.id, percent: 3 }] })
    const v2 = await newVersion(principal, f.formula.id, f.version.id, [{ displayName: 'Water', ingredientId: (await ingredientBySlug('water')).id, isQs: true }, { displayName: 'Glycerin', ingredientId: gly.id, percent: 6 }])
    expect(v2.version.versionNumber).toBe(2)
    const v1 = await prisma.formulaVersion.findUniqueOrThrow({ where: { id: f.version.id }, include: { lines: true } })
    expect(v1.locked).toBe(true)
    expect(Number(v1.lines.find((l) => !l.isQs)!.percent)).toBe(3)
  })

  it('cannot advance to prototype without chemist approval, and API keys may only create concepts', async () => {
    const author = await makeUser(['RESEARCH_SCIENTIST', 'COSMETIC_CHEMIST'])
    const f = await createFormula(author.principal, { code: `F-${uid()}`, name: 'gate', lines: [{ displayName: 'Water', ingredientId: (await ingredientBySlug('water')).id, percent: 100 }] })
    await expect(setStatus(author.principal, f.version.id, 'PROTOTYPE', 'try')).rejects.toBeInstanceOf(FormulaError)
    const apiKey = { ...author.principal, kind: 'API_KEY' as const, roles: ['SUPER_ADMIN' as const], scopes: ['formula:read', 'formula:write', 'formula:private:read'] }
    await expect(setStatus(apiKey, f.version.id, 'CHEMIST_REVIEW', 'try')).rejects.toThrow(/Automated clients/)

    await setStatus(author.principal, f.version.id, 'CHEMIST_REVIEW', 'ready')
    const task = await prisma.reviewTask.findFirstOrThrow({ where: { entityType: 'FormulaVersion', entityId: f.version.id } })
    await expect(decide(author.principal, task.id, 'APPROVED', 'self')).rejects.toThrow(/own submission/)
    const chemist = await makeUser(['COSMETIC_CHEMIST'])
    await decide(chemist.principal, task.id, 'APPROVED', 'looks reasonable')
    await setStatus(author.principal, f.version.id, 'PROTOTYPE', 'approved by chemist')
    await expect(setStatus(author.principal, f.version.id, 'APPROVED_FOR_MANUFACTURING', 'x')).rejects.toThrow(/Safety review/)
  })

  it('summaries flag unreviewed identities and do not invent costs', async () => {
    const { principal } = await makeUser(['COSMETIC_CHEMIST'])
    const gly = await ingredientBySlug('glycerin')
    const f = await createFormula(principal, { code: `F-${uid()}`, name: 'summary', lines: [{ displayName: 'Water', ingredientId: (await ingredientBySlug('water')).id, isQs: true }, { displayName: 'Glycerin', ingredientId: gly.id, percent: 4 }] })
    const s = await summarizeVersion(f.version.id)
    expect(s.cost.available).toBe(false)
    expect(s.unresolved.join(' ')).toMatch(/not yet reviewed|no canonical/i)
  })
})
