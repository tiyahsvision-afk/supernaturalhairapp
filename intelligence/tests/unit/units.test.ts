import { describe, expect, it } from 'vitest'
import { normalizeMeasurement, significantFigures, parseValue } from '@/lib/units'

describe('unit normalization', () => {
  it('converts mass and keeps the conversion method', () => {
    const r = normalizeMeasurement('500', 'mg')
    expect(r.normalizedValue).toBe(0.5)
    expect(r.normalizedUnit).toBe('g')
    expect(r.conversionMethod).toContain('mathjs')
    expect(r.flags).toEqual([])
  })
  it('converts Fahrenheit to Celsius', () => {
    expect(normalizeMeasurement('212', '°F').normalizedValue).toBeCloseTo(100, 6)
  })
  it('treats cP and mPa·s as equal and Pa·s as 1000 mPa·s', () => {
    expect(normalizeMeasurement('3500', 'cP').normalizedValue).toBe(3500)
    expect(normalizeMeasurement('3.5', 'Pa s').normalizedValue).toBe(3500)
  })
  it('converts explicit mass-fraction ppm to % w/w', () => {
    expect(normalizeMeasurement('10000', 'ppm w/w').normalizedValue).toBe(1)
    expect(normalizeMeasurement('50', 'mg/kg').normalizedValue).toBeCloseTo(0.005, 10)
  })
  it('does not convert bare ppm (basis unknown)', () => {
    const r = normalizeMeasurement('50', 'ppm')
    expect(r.flags).toContain('UNKNOWN_BASIS')
    expect(r.normalizedUnit).toBe('ppm')
    expect(r.normalizedValue).toBe(50)
  })
  it('flags ambiguous bare percentages and never converts % v/v to % w/w', () => {
    expect(normalizeMeasurement('2', '%').flags).toContain('AMBIGUOUS_PERCENTAGE')
    expect(normalizeMeasurement('2', '% v/v', 'MASS_PERCENT').flags).toContain('INCOMPATIBLE_UNIT')
  })
  it('flags missing units and impossible values', () => {
    expect(normalizeMeasurement('5', '').flags).toContain('MISSING_UNIT')
    expect(normalizeMeasurement('120', '% w/w').flags).toContain('IMPOSSIBLE_VALUE')
    expect(normalizeMeasurement('15', 'pH').flags).toContain('IMPOSSIBLE_VALUE')
    expect(normalizeMeasurement('-300', '°C').flags).toContain('IMPOSSIBLE_VALUE')
  })
  it('handles ranges and inverted ranges', () => {
    const r = normalizeMeasurement('0.5-2', '% w/w')
    expect([r.normalizedMin, r.normalizedMax]).toEqual([0.5, 2])
    expect(normalizeMeasurement('5-2', '% w/w').flags).toContain('RANGE_INVERTED')
  })
  it('flags unsupported units', () => {
    expect(normalizeMeasurement('3', 'furlongs').flags).toContain('UNSUPPORTED_CONVERSION')
  })
  it('counts significant figures as written', () => {
    expect(significantFigures('0.0500')).toBe(3)
    expect(significantFigures('1200')).toBe(2)
    expect(significantFigures('92.09')).toBe(4)
    expect(parseValue('abc')).toBeNull()
  })
})
