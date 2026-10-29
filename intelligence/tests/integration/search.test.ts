import { describe, expect, it } from 'vitest'
import { search } from '@/lib/search'
import { makeUser } from './fixtures'

describe('search', () => {
  const who = () => makeUser(['READ_ONLY_RESEARCHER']).then((u) => u.principal)
  const top = async (q: string) => (await search(await who(), q, { types: ['ingredient'], limit: 5 })).hits[0]

  it('ranks an exact canonical/INCI match first', async () => {
    const h = await top('Glycerin')
    expect(h.label).toMatch(/glycer/i)
    expect(h.tier).toBe(1)
  })
  it('finds ingredients by synonym, misspelling and INCI name', async () => {
    expect((await top('glycerine')).label).toMatch(/glycer/i)
    expect((await top('Butyrospermum Parkii Butter')).label).toMatch(/shea/i)
    expect((await top('provitamin b5')).label).toMatch(/panthenol|provitamin/i)
  })
  it('finds ingredients by identifier (PubChem CID, InChIKey)', async () => {
    const byCid = await top('753')
    expect(byCid.label).toMatch(/glycer/i)
    expect(byCid.why).toMatch(/identifier/i)
    expect((await top('PEDCQBHIVMGVHV-UHFFFAOYSA-N')).label).toMatch(/glycer/i)
  })
  it('tolerates case, accents and extra whitespace', async () => {
    expect((await top('  SHEA   butter ')).label).toMatch(/shea/i)
  })
  it('explains every hit', async () => {
    const res = await search(await who(), 'butter')
    expect(res.hits.length).toBeGreaterThan(1)
    for (const h of res.hits) expect(h.why.length).toBeGreaterThan(0)
    const tiers = res.hits.map((h) => h.tier)
    expect([...tiers].sort((a, b) => a - b)).toEqual(tiers)
  })
  it('returns no results (not an error) for nonsense', async () => {
    const res = await search(await who(), 'zzqxjv-not-an-ingredient')
    expect(res.hits).toHaveLength(0)
  })
})
