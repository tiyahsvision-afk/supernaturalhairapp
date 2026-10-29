import { describe, expect, it } from 'vitest'
import { activeConcentration, compareVersions, scaleBatch, validateFormula } from '@/lib/formula-math'

describe('formula mathematics', () => {
  it('validates a formula that totals exactly 100%', () => {
    const v = validateFormula([{ displayName: 'A', percent: 70.5, isQs: false }, { displayName: 'B', percent: 29.5, isQs: false }])
    expect(v.valid).toBe(true)
    expect(v.total).toBe(100)
  })
  it('rejects totals other than 100% without q.s.', () => {
    const v = validateFormula([{ displayName: 'A', percent: 70, isQs: false }, { displayName: 'B', percent: 20, isQs: false }])
    expect(v.valid).toBe(false)
    expect(v.errors[0]).toMatch(/not 100%/)
  })
  it('computes q.s. to 100 without floating-point drift', () => {
    const v = validateFormula([{ displayName: 'Water', percent: null, isQs: true }, { displayName: 'A', percent: 0.1, isQs: false }, { displayName: 'B', percent: 0.2, isQs: false }])
    expect(v.qsAmount).toBe(99.7)
    expect(v.valid).toBe(true)
  })
  it('rejects more than one q.s. line and negative remainders', () => {
    expect(validateFormula([{ displayName: 'W1', percent: null, isQs: true }, { displayName: 'W2', percent: null, isQs: true }]).valid).toBe(false)
    expect(validateFormula([{ displayName: 'W', percent: null, isQs: true }, { displayName: 'A', percent: 101, isQs: false }]).valid).toBe(false)
  })
  it('computes active level only from a confirmed active percentage (50% active at 4% use = 2%)', () => {
    expect(activeConcentration(4, 50)).toBe(2)
    const v = validateFormula([
      { displayName: 'Water', percent: null, isQs: true },
      { displayName: 'Confirmed RM', percent: 4, isQs: false, rawMaterialActivePercent: 50, rawMaterialActiveConfirmed: true },
      { displayName: 'Unconfirmed RM', percent: 4, isQs: false, rawMaterialActivePercent: 50, rawMaterialActiveConfirmed: false },
    ])
    expect(v.activeLevels[1].activePercent).toBe(2)
    expect(v.activeLevels[2].activePercent).toBeNull()
  })
  it('computes phase totals', () => {
    const v = validateFormula([{ displayName: 'W', percent: null, isQs: true, phase: 'A' }, { displayName: 'O', percent: 10, isQs: false, phase: 'B' }])
    expect(v.phaseTotals).toEqual({ A: 90, B: 10 })
  })
  it('scales batches with manufacturing loss', () => {
    const s = scaleBatch([{ displayName: 'W', percent: 90 }, { displayName: 'O', percent: 10 }], 1000, 0)
    expect(s.map((x) => x.quantity)).toEqual([900, 100])
    expect(scaleBatch([{ displayName: 'W', percent: 100 }], 1000, 2)[0].quantity).toBeCloseTo(1020.408163, 5)
    expect(() => scaleBatch([], 0)).toThrow()
  })
  it('compares versions line by line', () => {
    const d = compareVersions([{ key: 'a', displayName: 'A', percent: 1, isQs: false }], [{ key: 'a', displayName: 'A', percent: 2, isQs: false }, { key: 'b', displayName: 'B', percent: 1, isQs: false }])
    expect(d.map((x) => x.status)).toEqual(['CHANGED', 'ADDED'])
  })
})
