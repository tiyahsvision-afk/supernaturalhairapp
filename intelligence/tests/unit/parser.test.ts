import { describe, expect, it } from 'vitest'
import { parseIngredientList, splitTopLevel } from '@/lib/inci-parser'
import { isValidCas, isValidEc, normalizeName, stripParentheticals, detectIdentifier } from '@/lib/normalize'

describe('ingredient list parser', () => {
  it('preserves displayed order and does not split inside parentheses', () => {
    const r = parseIngredientList('INGREDIENTS: Aqua (Water), Olea Europaea (Olive) Fruit Oil, Glycerin, Cetyl Alcohol')
    expect(r.items.map((i) => i.displayedName)).toEqual(['Aqua (Water)', 'Olea Europaea (Olive) Fruit Oil', 'Glycerin', 'Cetyl Alcohol'])
    expect(r.items.map((i) => i.position)).toEqual([1, 2, 3, 4])
  })
  it('removes certified-organic footnotes and asterisk markers without reordering', () => {
    const r = parseIngredientList('Water, *Orbignya Oleifera (Babassu) Seed Oil, Biotin *Certified Organic Ingredient')
    expect(r.items.map((i) => i.displayedName)).toEqual(['Water', 'Orbignya Oleifera (Babassu) Seed Oil', 'Biotin'])
    expect(r.removedNotes[0]).toMatch(/certified organic/i)
    expect(r.items[1].flags).toContain('MARKER_STRIPPED')
  })
  it('keeps multilingual slash names together', () => {
    expect(splitTopLevel('Aqua/Water/Eau, Glycerin')).toEqual(['Aqua/Water/Eau', 'Glycerin'])
  })
  it('flags "may contain" sections and suspect genus-only fragments instead of guessing', () => {
    const r = parseIngredientList('Water, Ocimum, Basilicum (Basil) Oil, May contain: CI 77891')
    expect(r.items.find((i) => i.displayedName === 'Ocimum')?.flags).toContain('SUSPECT_FRAGMENT')
    expect(r.items.at(-1)?.flags).toContain('MAY_CONTAIN')
  })
  it('flags trade names in parentheses', () => {
    expect(parseIngredientList('Phenoxyethanol (Optiphen ND), Water').items[0].flags).toContain('TRADE_NAME_IN_PARENS')
  })
})

describe('normalization and identifiers', () => {
  it('normalizes case, accents and spacing but not meaning', () => {
    expect(normalizeName('  Glycérine  ')).toBe('glycerine')
    expect(stripParentheticals('Olea Europaea (Olive) Fruit Oil')).toBe('olea europaea fruit oil')
    expect(normalizeName('Burdock Extract')).not.toBe(normalizeName('Arctium Lappa Root Extract'))
  })
  it('validates CAS check digits', () => {
    expect(isValidCas('56-81-5')).toBe(true) // glycerol
    expect(isValidCas('7732-18-5')).toBe(true) // water
    expect(isValidCas('56-81-6')).toBe(false)
  })
  it('validates EC check digits', () => {
    expect(isValidEc('200-289-5')).toBe(true) // glycerol
    expect(isValidEc('200-289-4')).toBe(false)
  })
  it('detects identifier-shaped queries', () => {
    expect(detectIdentifier('56-81-5')).toBe('CAS')
    expect(detectIdentifier('PEDCQBHIVMGVHV-UHFFFAOYSA-N')).toBe('INCHIKEY')
    expect(detectIdentifier('753')).toBe('PUBCHEM_CID')
    expect(detectIdentifier('panthenol')).toBeNull()
  })
})
