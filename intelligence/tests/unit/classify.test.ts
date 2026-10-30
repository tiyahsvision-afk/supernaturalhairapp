import { describe, expect, it } from 'vitest'
import { classify, identityFromName, inciLabelCase } from '@/lib/classify'
import { parseFormulaText } from '@/lib/research/formulation'
import { mapOutcomes } from '@/lib/research/claim'
import { parseAnnex } from '../../seed/cosing'

const codes = (n: string, f: string[] = []) => classify(n, f).map((c) => c.code)

describe('rule-derived classification', () => {
  it('distinguishes sulfate cleansers from quat counter-ions and inorganic sulfates', () => {
    expect(codes('SODIUM LAURETH SULFATE', ['cleansing', 'surfactant'])).toContain('sulfate-surfactant')
    expect(codes('AMMONIUM LAURYL SULFATE', ['surfactant'])).toContain('sulfate-surfactant')
    expect(codes('AMMONIUM LAURYL SULFATE', ['surfactant'])).not.toContain('cationic')
    expect(codes('BEHENTRIMONIUM METHOSULFATE', ['hair-conditioning', 'surfactant'])).toEqual(['cationic'])
    expect(codes('MAGNESIUM SULFATE', ['viscosity-controlling'])).not.toContain('sulfate-surfactant')
  })
  it('recognises cationic conditioners, amphoterics and nonionics', () => {
    for (const n of ['BEHENTRIMONIUM CHLORIDE', 'POLYQUATERNIUM-10', 'GUAR HYDROXYPROPYLTRIMONIUM CHLORIDE', 'DIPALMITOYLETHYL HYDROXYETHYLMONIUM METHOSULFATE']) expect(codes(n, ['hair-conditioning']), n).toContain('cationic')
    expect(codes('STEARAMIDOPROPYL DIMETHYLAMINE')).toContain('cationic-at-acidic-ph')
    expect(codes('COCAMIDOPROPYL BETAINE', ['surfactant'])).toContain('amphoteric-surfactant')
    expect(codes('DECYL GLUCOSIDE', ['surfactant', 'cleansing'])).toContain('nonionic-surfactant')
  })
  it('separates silicones from PEG-modified silicones and screens for the Curly Girl guideline', () => {
    expect(codes('AMODIMETHICONE')).toEqual(expect.arrayContaining(['silicone', 'cg-avoid']))
    expect(codes('PEG-12 DIMETHICONE', ['emulsifying'])).toEqual(expect.arrayContaining(['water-dispersible-silicone', 'cg-caution']))
    expect(codes('PEG-12 DIMETHICONE', ['emulsifying'])).not.toContain('silicone')
  })
  it('flags proteins, alcohols, allergens and preservative classes', () => {
    expect(codes('HYDROLYZED WHEAT PROTEIN')).toContain('protein')
    expect(codes('CETEARYL ALCOHOL')).toContain('fatty-alcohol')
    expect(codes('CETEARYL ALCOHOL')).not.toContain('short-chain-alcohol')
    expect(codes('ALCOHOL DENAT.')).toContain('short-chain-alcohol')
    expect(codes('LINALOOL', ['perfuming'])).toContain('eu-fragrance-allergen')
    expect(codes('DMDM HYDANTOIN', ['preservative'])).toEqual(expect.arrayContaining(['formaldehyde-releaser', 'preservative']))
    expect(codes('METHYLPARABEN', ['preservative'])).toContain('paraben')
  })
  it('every derived class carries the rule that produced it', () => {
    for (const c of classify('SODIUM LAURETH SULFATE', ['surfactant'])) expect(c.basis.length).toBeGreaterThan(10)
  })
  it('assigns identity types from naming conventions', () => {
    expect(identityFromName('ROSMARINUS OFFICINALIS LEAF EXTRACT', [])).toEqual({ identityType: 'BOTANICAL_EXTRACT', materialType: 'BOTANICAL_EXTRACT' })
    expect(identityFromName('DIMETHICONE', []).materialType).toBe('SILICONE')
    expect(identityFromName('CI 77491', []).materialType).toBe('COLORANT')
  })
  it('converts INCI to label case without mangling codes', () => {
    expect(inciLabelCase('PEG-40 HYDROGENATED CASTOR OIL')).toBe('PEG-40 Hydrogenated Castor Oil')
    expect(inciLabelCase('MELALEUCA ALTERNIFOLIA (TEA TREE) LEAF OIL')).toBe('Melaleuca Alternifolia (Tea Tree) Leaf Oil')
    expect(inciLabelCase('TEA-LAURYL SULFATE')).toBe('TEA-Lauryl Sulfate')
    expect(inciLabelCase('CI 77491')).toBe('CI 77491')
  })
})

describe('CosIng annex parsing', () => {
  it('picks the most restrictive annex', () => {
    expect(parseAnnex('III/61, V/35')?.annex).toBe('III')
    expect(parseAnnex('V/29')?.annex).toBe('V')
    expect(parseAnnex('Annex III/I/262 - Directive 2012/21/EU')?.refs[0]).toBe('III/I/262')
    expect(parseAnnex('none')).toBeNull()
  })
})

describe('formula text parsing', () => {
  it('reads percentages, q.s. and comma-separated lists', () => {
    expect(parseFormulaText('Aqua q.s.\nGlycerin 3\nBehentrimonium Chloride, 2 %\nParfum 0,5')).toEqual([{ name: 'Aqua', qs: true }, { name: 'Glycerin', percent: 3 }, { name: 'Behentrimonium Chloride', percent: 2 }, { name: 'Parfum', percent: 0.5 }])
    expect(parseFormulaText('Water, Glycerin, Cetearyl Alcohol').map((l) => l.name)).toEqual(['Water', 'Glycerin', 'Cetearyl Alcohol'])
  })
})

describe('claim outcome mapping', () => {
  it('maps claim words to hair/scalp outcome terms', () => {
    expect(mapOutcomes('Reduces breakage and frizz')).toEqual(expect.arrayContaining(['breakage', 'frizz-response']))
    expect(mapOutcomes('Promotes hair growth')).toContain('apparent-density-change')
  })
})
