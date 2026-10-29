import { describe, expect, it } from 'vitest'
import { prisma } from '@/lib/db'
import { can, visibilityWhere } from '@/lib/permissions'
import { createFormula, getFormulaForPrincipal, FormulaError, setStatus } from '@/lib/services/formulas'
import { search } from '@/lib/search'
import { makeOrg, makeUser, uid, ingredientBySlug } from './fixtures'

describe('organization isolation and IP protection', () => {
  it('a formula owned by one organization is invisible to every role in another organization — including super admin', async () => {
    const owner = await makeUser(['COSMETIC_CHEMIST'])
    const { formula } = await createFormula(owner.principal, { code: `ISO-${uid()}`, name: 'Isolation test', visibility: 'RESTRICTED', lines: [{ displayName: 'Water', ingredientId: (await ingredientBySlug('water')).id, percent: 100 }] })
    const other = await makeOrg('BRAND')
    for (const roles of [['BRAND_PARTNER'], ['SUPER_ADMIN'], ['COSMETIC_CHEMIST']] as const) {
      const outsider = await makeUser([...roles], other.id)
      expect(await getFormulaForPrincipal(outsider.principal, formula.id), roles.join()).toBeNull()
      const listed = await prisma.formula.findMany({ where: { AND: [visibilityWhere(outsider.principal), { id: formula.id }] } })
      expect(listed, roles.join()).toHaveLength(0)
    }
    expect(await getFormulaForPrincipal(owner.principal, formula.id)).not.toBeNull()
  })

  it('RESTRICTED formulas need formula:private:read even inside the owning organization', async () => {
    const owner = await makeUser(['COSMETIC_CHEMIST'])
    const { formula } = await createFormula(owner.principal, { code: `RST-${uid()}`, name: 'Restricted', visibility: 'RESTRICTED', lines: [{ displayName: 'Water', ingredientId: (await ingredientBySlug('water')).id, percent: 100 }] })
    const annotator = await makeUser(['DATA_ANNOTATOR'])
    expect(can(annotator.principal, 'formula:private:read')).toBe(false)
    expect(await getFormulaForPrincipal(annotator.principal, formula.id)).toBeNull()
  })

  it('outsiders cannot edit or change the status of another organization’s formula', async () => {
    const owner = await makeUser(['COSMETIC_CHEMIST'])
    const { formula, version } = await createFormula(owner.principal, { code: `EDT-${uid()}`, name: 'No edit', visibility: 'ORGANIZATION', lines: [{ displayName: 'Water', ingredientId: (await ingredientBySlug('water')).id, percent: 100 }] })
    const outsider = await makeUser(['COSMETIC_CHEMIST'], (await makeOrg('BRAND')).id)
    await expect(setStatus(outsider.principal, version.id, 'RESEARCH_CANDIDATE', 'x')).rejects.toBeInstanceOf(FormulaError)
    expect(formula.ownerOrgId).toBe(owner.principal.organizationId)
  })

  it('confidential research candidates are not returned by search to other organizations or to roles without ip:read', async () => {
    const outsider = await makeUser(['SUPER_ADMIN'], (await makeOrg('BRAND')).id)
    const res = await search(outsider.principal, 'SN-001')
    expect(res.hits.filter((h) => h.entityType === 'research_candidate')).toHaveLength(0)
    const reader = await makeUser(['READ_ONLY_RESEARCHER'])
    const res2 = await search(reader.principal, 'SN-001')
    expect(res2.hits.filter((h) => h.entityType === 'research_candidate')).toHaveLength(0)
    const scientist = await makeUser(['RESEARCH_SCIENTIST'])
    const res3 = await search(scientist.principal, 'SN-001')
    expect(res3.hits.some((h) => h.entityType === 'research_candidate')).toBe(true)
  })

  it('partners cannot see sample formulas owned by Supernatural in search', async () => {
    const partner = await makeUser(['BRAND_PARTNER'], (await prisma.organization.findUniqueOrThrow({ where: { slug: 'sample-brand-partner' } })).id)
    const res = await search(partner.principal, 'SAMPLE-SH-01')
    expect(res.hits.filter((h) => h.entityType === 'formula')).toHaveLength(0)
  })
})
