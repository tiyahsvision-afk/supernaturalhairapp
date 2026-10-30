import { describe, expect, it } from 'vitest'
import { prisma } from '@/lib/db'
import { runSubstitutes } from '@/lib/research/substitutes'
import { runFormulation } from '@/lib/research/formulation'
import { runClaim } from '@/lib/research/claim'
import { runCompare } from '@/lib/research/compare'
import { runBrief } from '@/lib/research/brief'
import { runAssistant } from '@/lib/research/assistant'
import { runSuppliers } from '@/lib/research/suppliers'
import { dimensionsFor, loadIntel } from '@/lib/dimensions'
import { createFormula } from '@/lib/services/formulas'
import { importCosing } from '../../seed/cosing'
import { ingredientBySlug, makeOrg, makeUser, sourceId, uid } from './fixtures'

const EQUIVALENCE = /(performs? (the same|equivalently|identically)|equivalent performance is (shown|proven|established)|guaranteed|will reduce cost)/i

describe('CosIng data foundation', () => {
  it('imported the EU inventory with provenance, and re-importing creates nothing', async () => {
    expect(await prisma.ingredient.count({ where: { cosingRef: { not: null } } })).toBeGreaterThan(20000)
    const { principal } = await makeUser(['DATA_ADMIN'])
    const again = await importCosing(principal, await sourceId('eu-cosing-obf'))
    expect(again.created).toBe(0)
    expect(again.linked).toBe(0)
    const sles = await prisma.ingredient.findFirstOrThrow({ where: { cosingRef: '79583' }, include: { identifiers: true } })
    expect(sles.derivedClasses).toContain('sulfate-surfactant')
    expect(sles.identifiers.every((i) => i.verificationStatus !== 'VERIFIED' || i.type !== 'CAS')).toBe(true)
  })
  it('never fills a technical dimension without a source', async () => {
    const { principal } = await makeUser(['READ_ONLY_RESEARCHER'])
    const [intel] = (await loadIntel(principal, [(await ingredientBySlug('glycerin')).id])).map(dimensionsFor)
    for (const d of intel.dims) {
      if (d.status === 'MISSING' || d.status === 'NOT_APPLICABLE') expect(d.value, d.key).toBeNull()
      else expect(d.value, d.key).toBeTruthy()
    }
    expect(intel.dims.find((d) => d.key === 'oxidation')?.status).toBe('MISSING')
  })
})

describe('research workflows', () => {
  it('substitutes: respects exclusions, never includes the target, and never claims equivalence', async () => {
    const { principal } = await makeUser(['COSMETIC_CHEMIST'])
    const target = await ingredientBySlug('sodium-laureth-sulfate')
    const r = await runSubstitutes(principal, { ingredientId: target.id, reason: 'sulfate-free positioning', avoidClasses: ['sulfate-surfactant'] })
    const ids = r.citations.filter((c) => c.kind === 'ingredient').map((c) => c.id.slice(4)).filter((id) => id !== target.id)
    expect(ids.length).toBeGreaterThan(0)
    const cands = await prisma.ingredient.findMany({ where: { id: { in: ids } } })
    for (const c of cands) expect(c.derivedClasses, c.displayName).not.toContain('sulfate-surfactant')
    expect(r.findings.some((f) => f.certainty === 'NEEDS_TESTING' && /equivalence is not established/i.test(f.title))).toBe(true)
    expect(JSON.stringify(r)).not.toMatch(EQUIVALENCE)
  })

  it('formulation: flags complexation, preservation, pH-dependent preservatives, allergens and unidentified lines', async () => {
    const { principal } = await makeUser(['COSMETIC_CHEMIST'])
    const r = await runFormulation(principal, { lines: [{ name: 'Aqua', qs: true }, { name: 'Sodium Laureth Sulfate', percent: 10 }, { name: 'Behentrimonium Chloride', percent: 2 }, { name: 'Sodium Benzoate', percent: 0.5 }, { name: 'Linalool', percent: 0.01 }, { name: 'Zorblax Extract', percent: 1 }], targetPh: 6.5, markets: ['EU'] })
    const titles = r.findings.map((f) => f.title).join(' | ')
    expect(titles).toMatch(/Cationic and anionic/)
    expect(titles).toMatch(/pH-dependent preservative/)
    expect(titles).toMatch(/EU labelled fragrance allergens/)
    expect(titles).toMatch(/not confidently identified/)
    const noPres = await runFormulation(principal, { lines: [{ name: 'Aqua', qs: true }, { name: 'Glycerin', percent: 5 }] })
    expect(noPres.findings.map((f) => f.title).join(' ')).toMatch(/No ingredient with an official preservative function/)
  })

  it('formulation: another organization’s formula cannot be analysed', async () => {
    const owner = await makeUser(['COSMETIC_CHEMIST'])
    const { formula } = await createFormula(owner.principal, { code: `PRIV-${uid()}`, name: 'Private', visibility: 'ORGANIZATION', lines: [{ displayName: 'Water', ingredientId: (await ingredientBySlug('water')).id, percent: 100 }] })
    const outsider = await makeUser(['COSMETIC_CHEMIST'], (await makeOrg('BRAND')).id)
    await expect(runFormulation(outsider.principal, { formulaId: formula.id })).rejects.toThrow(/not found or not visible/)
  })

  it('claim: drug wording needs specialist review and medical-context studies never support a cosmetic claim', async () => {
    const { principal } = await makeUser(['RESEARCH_SCIENTIST'])
    const r = await runClaim(principal, { claim: 'Stops hair loss and regrows edges — clinically proven' })
    expect(r.findings.some((f) => f.certainty === 'REVIEW_REQUIRED' && /drug or medicinal/i.test(f.title))).toBe(true)
    expect(r.findings.some((f) => /Proof language/.test(f.title))).toBe(true)
    const med = await prisma.evidence.findFirst({ where: { medicalContext: true, links: { some: { ingredientId: { not: null } } } }, include: { links: true } })
    if (med) {
      const ing = med.links.find((l) => l.ingredientId)!.ingredientId!
      const r2 = await runClaim(principal, { claim: 'Improves the appearance of fuller hair', ingredientIds: [ing] })
      for (const f of r2.findings.filter((x) => x.citations.includes(`ev:${med.id}`))) expect(f.certainty).not.toBe('SUPPORTED')
    }
  })

  it('comparison requires two ingredients and labels every value', async () => {
    const { principal } = await makeUser(['COSMETIC_CHEMIST'])
    await expect(runCompare(principal, { ingredientIds: [(await ingredientBySlug('glycerin')).id] })).rejects.toThrow(/at least two/)
    const r = await runCompare(principal, { ingredientIds: [(await ingredientBySlug('glycerin')).id, (await ingredientBySlug('panthenol')).id] })
    const table = r.tables[0]
    for (const row of table.rows) for (const cell of row.slice(1)) expect(typeof cell === 'object' && cell.status, String(row[0])).toBeTruthy()
  })

  it('founder brief: honours preferences, gives no percentages or prices, and says it is not a formulation', async () => {
    const { principal } = await makeUser(['BRAND_PARTNER'], (await makeOrg('BRAND')).id)
    const r = await runBrief(principal, { category: 'shampoo', targetCustomer: 'coily hair', performance: 'gentle cleansing that does not strip', concerns: ['scalp-dryness'], preferences: ['sulfate-free', 'silicone-free'], investigate: '', avoid: 'Fragrance', texture: '', markets: ['US', 'EU'], retailPrice: '$15', constraints: '' })
    const ids = r.citations.filter((c) => c.kind === 'ingredient').map((c) => c.id.slice(4))
    const ings = await prisma.ingredient.findMany({ where: { id: { in: ids } } })
    for (const i of ings) { expect(i.derivedClasses, i.displayName).not.toContain('sulfate-surfactant'); expect(i.derivedClasses, i.displayName).not.toContain('silicone') }
    expect(r.summary).toMatch(/not a finished, safety-tested formulation/)
    expect(JSON.stringify(r.tables)).not.toMatch(/\d+(\.\d+)?\s?%\s*(w\/w)?\s*(of|in) (the )?formula/i)
    expect(r.citations.some((c) => c.kind === 'official' && c.href?.startsWith('https://'))).toBe(true)
  })

  it('suppliers: reports gaps instead of inventing suppliers', async () => {
    const { principal } = await makeUser(['COSMETIC_CHEMIST'], (await makeOrg('BRAND')).id)
    const r = await runSuppliers(principal, { ingredientId: (await ingredientBySlug('glycerin')).id })
    expect(r.findings[0].title).toMatch(/No supplier materials on file/)
    expect(r.tables).toHaveLength(0)
  })

  it('assistant without an API key returns cited records and does not call a model', async () => {
    const prev = process.env.ANTHROPIC_API_KEY
    delete process.env.ANTHROPIC_API_KEY
    const { principal } = await makeUser(['RESEARCH_SCIENTIST'])
    const { result, aiUsed } = await runAssistant(principal, 'Which conditioning ingredients help wet detangling?')
    if (prev) process.env.ANTHROPIC_API_KEY = prev
    expect(aiUsed).toBe(false)
    expect(result.citations.length).toBeGreaterThan(0)
    const ids = new Set(result.citations.map((c) => c.id))
    for (const f of result.findings) for (const c of f.citations) expect(ids.has(c)).toBe(true)
  })
})
