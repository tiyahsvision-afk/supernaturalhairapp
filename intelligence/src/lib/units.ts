import { unit as mathUnit } from 'mathjs'

// Controlled measurement system. Conversions use mathjs where dimensionally valid; concentration bases (w/w, v/v, w/v)
// are never converted into each other because that needs density data the record does not carry.
export const CONVERSION_VERSION = 'units-1.0.0'

export type MeasurementCategory =
  | 'MASS' | 'VOLUME' | 'MASS_PERCENT' | 'VOLUME_PERCENT' | 'WEIGHT_BY_VOLUME_PERCENT' | 'PERCENT_UNKNOWN_BASIS'
  | 'PPM' | 'PPB' | 'MOLARITY' | 'MOLECULAR_WEIGHT' | 'TEMPERATURE' | 'TIME' | 'VISCOSITY' | 'DENSITY' | 'PH'
  | 'PRESSURE' | 'PARTICLE_SIZE' | 'TENSILE_FORCE' | 'HUMIDITY' | 'COUNT' | 'DIMENSIONLESS' | 'OTHER'

export type MeasurementFlag =
  | 'MISSING_UNIT' | 'INCOMPATIBLE_UNIT' | 'IMPOSSIBLE_VALUE' | 'AMBIGUOUS_PERCENTAGE' | 'UNKNOWN_BASIS'
  | 'UNSUPPORTED_CONVERSION' | 'UNPARSEABLE_VALUE' | 'RANGE_INVERTED'

interface UnitDef { category: MeasurementCategory; math?: string; canonical: string; factor?: number }

// Canonical unit per category. `math` is the mathjs unit string; `factor` converts to canonical for non-mathjs units.
const UNITS: Record<string, UnitDef> = {
  g: { category: 'MASS', math: 'g', canonical: 'g' },
  mg: { category: 'MASS', math: 'mg', canonical: 'g' },
  kg: { category: 'MASS', math: 'kg', canonical: 'g' },
  ug: { category: 'MASS', math: 'ug', canonical: 'g' },
  'µg': { category: 'MASS', math: 'ug', canonical: 'g' },
  oz: { category: 'MASS', math: 'ounce', canonical: 'g' },
  lb: { category: 'MASS', math: 'lbm', canonical: 'g' },
  ml: { category: 'VOLUME', math: 'mL', canonical: 'mL' },
  l: { category: 'VOLUME', math: 'L', canonical: 'mL' },
  ul: { category: 'VOLUME', math: 'uL', canonical: 'mL' },
  'fl oz': { category: 'VOLUME', math: 'floz', canonical: 'mL' },
  '% w/w': { category: 'MASS_PERCENT', canonical: '% w/w', factor: 1 },
  '%w/w': { category: 'MASS_PERCENT', canonical: '% w/w', factor: 1 },
  'wt%': { category: 'MASS_PERCENT', canonical: '% w/w', factor: 1 },
  '% wt': { category: 'MASS_PERCENT', canonical: '% w/w', factor: 1 },
  'ppm w/w': { category: 'MASS_PERCENT', canonical: '% w/w', factor: 1e-4 },
  'mg/kg': { category: 'MASS_PERCENT', canonical: '% w/w', factor: 1e-4 },
  'ppb w/w': { category: 'MASS_PERCENT', canonical: '% w/w', factor: 1e-7 },
  'ug/kg': { category: 'MASS_PERCENT', canonical: '% w/w', factor: 1e-7 },
  '% v/v': { category: 'VOLUME_PERCENT', canonical: '% v/v', factor: 1 },
  '% w/v': { category: 'WEIGHT_BY_VOLUME_PERCENT', canonical: '% w/v', factor: 1 },
  'g/100 ml': { category: 'WEIGHT_BY_VOLUME_PERCENT', canonical: '% w/v', factor: 1 },
  '%': { category: 'PERCENT_UNKNOWN_BASIS', canonical: '%', factor: 1 },
  ppm: { category: 'PPM', canonical: 'ppm', factor: 1 },
  ppb: { category: 'PPB', canonical: 'ppb', factor: 1 },
  'mol/l': { category: 'MOLARITY', math: 'mol/L', canonical: 'mmol/L' },
  'mmol/l': { category: 'MOLARITY', math: 'mmol/L', canonical: 'mmol/L' },
  m: { category: 'MOLARITY', math: 'mol/L', canonical: 'mmol/L' },
  mm: { category: 'PARTICLE_SIZE', math: 'mm', canonical: 'um' },
  'g/mol': { category: 'MOLECULAR_WEIGHT', canonical: 'g/mol', factor: 1 },
  da: { category: 'MOLECULAR_WEIGHT', canonical: 'g/mol', factor: 1 },
  kda: { category: 'MOLECULAR_WEIGHT', canonical: 'g/mol', factor: 1000 },
  '°c': { category: 'TEMPERATURE', math: 'degC', canonical: '°C' },
  c: { category: 'TEMPERATURE', math: 'degC', canonical: '°C' },
  degc: { category: 'TEMPERATURE', math: 'degC', canonical: '°C' },
  '°f': { category: 'TEMPERATURE', math: 'degF', canonical: '°C' },
  f: { category: 'TEMPERATURE', math: 'degF', canonical: '°C' },
  k: { category: 'TEMPERATURE', math: 'K', canonical: '°C' },
  s: { category: 'TIME', math: 's', canonical: 'h' },
  min: { category: 'TIME', math: 'min', canonical: 'h' },
  h: { category: 'TIME', math: 'h', canonical: 'h' },
  d: { category: 'TIME', math: 'day', canonical: 'h' },
  day: { category: 'TIME', math: 'day', canonical: 'h' },
  days: { category: 'TIME', math: 'day', canonical: 'h' },
  week: { category: 'TIME', math: 'week', canonical: 'h' },
  weeks: { category: 'TIME', math: 'week', canonical: 'h' },
  cp: { category: 'VISCOSITY', canonical: 'mPa·s', factor: 1 },
  'mpa·s': { category: 'VISCOSITY', canonical: 'mPa·s', factor: 1 },
  'mpa s': { category: 'VISCOSITY', canonical: 'mPa·s', factor: 1 },
  'pa·s': { category: 'VISCOSITY', canonical: 'mPa·s', factor: 1000 },
  'pa s': { category: 'VISCOSITY', canonical: 'mPa·s', factor: 1000 },
  'g/cm3': { category: 'DENSITY', math: 'g/cm^3', canonical: 'g/cm^3' },
  'g/cm^3': { category: 'DENSITY', math: 'g/cm^3', canonical: 'g/cm^3' },
  'g/ml': { category: 'DENSITY', math: 'g/mL', canonical: 'g/cm^3' },
  'kg/m3': { category: 'DENSITY', math: 'kg/m^3', canonical: 'g/cm^3' },
  'kg/m^3': { category: 'DENSITY', math: 'kg/m^3', canonical: 'g/cm^3' },
  ph: { category: 'PH', canonical: 'pH', factor: 1 },
  pa: { category: 'PRESSURE', math: 'Pa', canonical: 'kPa' },
  kpa: { category: 'PRESSURE', math: 'kPa', canonical: 'kPa' },
  bar: { category: 'PRESSURE', math: 'bar', canonical: 'kPa' },
  psi: { category: 'PRESSURE', math: 'psi', canonical: 'kPa' },
  atm: { category: 'PRESSURE', math: 'atm', canonical: 'kPa' },
  nm: { category: 'PARTICLE_SIZE', math: 'nm', canonical: 'um' },
  um: { category: 'PARTICLE_SIZE', math: 'um', canonical: 'um' },
  'µm': { category: 'PARTICLE_SIZE', math: 'um', canonical: 'um' },
  n: { category: 'TENSILE_FORCE', math: 'N', canonical: 'N' },
  gf: { category: 'TENSILE_FORCE', canonical: 'N', factor: 0.00980665 },
  '% rh': { category: 'HUMIDITY', canonical: '% RH', factor: 1 },
  count: { category: 'COUNT', canonical: 'count', factor: 1 },
  dimensionless: { category: 'DIMENSIONLESS', canonical: 'dimensionless', factor: 1 },
  'å²': { category: 'OTHER', canonical: 'Å²', factor: 1 },
  'e': { category: 'DIMENSIONLESS', canonical: 'e (elementary charge)', factor: 1 },
}

export function lookupUnit(u: string | null | undefined): UnitDef | null {
  if (!u) return null
  return UNITS[u.trim().toLowerCase().replace(/\s+/g, ' ')] ?? null
}

/** Counts significant figures in the value exactly as written. */
export function significantFigures(raw: string): number | null {
  const s = raw.trim().replace(/^[-+]/, '')
  if (!/^\d*\.?\d+(e[-+]?\d+)?$/i.test(s)) return null
  const mantissa = s.split(/e/i)[0]
  if (mantissa.includes('.')) {
    const digits = mantissa.replace('.', '').replace(/^0+/, '')
    return digits.length || 1
  }
  const trimmed = mantissa.replace(/^0+/, '').replace(/0+$/, '')
  return trimmed.length || 1
}

export interface ParsedValue { value?: number; min?: number; max?: number; isRange: boolean; raw: string }

/** Parses "0.5", "0.5-2", "0.5–2", "<1", "1 to 3". Inequalities are kept as text only. */
export function parseValue(raw: string): ParsedValue | null {
  const s = raw.trim().replace(/,/g, '')
  const range = /^(-?\d*\.?\d+)\s*(?:-|–|—|to)\s*(-?\d*\.?\d+)$/i.exec(s)
  if (range) return { min: Number(range[1]), max: Number(range[2]), isRange: true, raw }
  if (/^-?\d*\.?\d+(e[-+]?\d+)?$/i.test(s)) return { value: Number(s), isRange: false, raw }
  return null
}

export interface NormalizationResult {
  category: MeasurementCategory | null
  normalizedUnit: string | null
  normalizedValue?: number
  normalizedMin?: number
  normalizedMax?: number
  conversionMethod: string | null
  conversionVersion: string
  significantFigures: number | null
  flags: MeasurementFlag[]
}

function convert(v: number, def: UnitDef): number {
  if (def.factor !== undefined) return v * def.factor
  const target = def.canonical === '°C' ? 'degC' : def.canonical === 'g/cm^3' ? 'g/cm^3' : def.canonical
  return mathUnit(v, def.math!).toNumber(target)
}

const round = (n: number) => Number(n.toPrecision(12))

function impossible(category: MeasurementCategory, v: number): boolean {
  switch (category) {
    case 'MASS_PERCENT': case 'VOLUME_PERCENT': case 'PERCENT_UNKNOWN_BASIS': case 'HUMIDITY':
      return v < 0 || v > 100
    case 'PH':
      return v < 0 || v > 14
    case 'TEMPERATURE':
      return v < -273.15
    case 'MASS': case 'VOLUME': case 'MOLECULAR_WEIGHT': case 'VISCOSITY': case 'DENSITY': case 'PARTICLE_SIZE':
    case 'TIME': case 'PPM': case 'PPB': case 'MOLARITY': case 'COUNT': case 'WEIGHT_BY_VOLUME_PERCENT':
      return v < 0
    default:
      return false
  }
}

/**
 * Normalizes a measurement without losing the original. Returns flags instead of throwing; callers persist flags and
 * route flagged records to quarantine.
 */
export function normalizeMeasurement(rawValue: string, rawUnit: string | null | undefined, expected?: MeasurementCategory): NormalizationResult {
  const flags: MeasurementFlag[] = []
  const base: NormalizationResult = { category: null, normalizedUnit: null, conversionMethod: null, conversionVersion: CONVERSION_VERSION, significantFigures: null, flags }
  const parsed = parseValue(rawValue)
  if (!parsed) {
    flags.push('UNPARSEABLE_VALUE')
    return base
  }
  base.significantFigures = parsed.value !== undefined ? significantFigures(String(rawValue).trim()) : null
  if (!rawUnit || !rawUnit.trim()) {
    flags.push('MISSING_UNIT')
    return base
  }
  const def = lookupUnit(rawUnit)
  if (!def) {
    flags.push('UNSUPPORTED_CONVERSION')
    return base
  }
  base.category = def.category
  if (expected && expected !== def.category) {
    flags.push('INCOMPATIBLE_UNIT')
    return base
  }
  const values = parsed.isRange ? [parsed.min!, parsed.max!] : [parsed.value!]
  if (parsed.isRange && parsed.min! > parsed.max!) flags.push('RANGE_INVERTED')
  // Mass-fraction inputs (ppm w/w, mg/kg) are checked after conversion to % w/w.
  for (const v of values) if (impossible(def.category, def.category === 'MASS_PERCENT' && def.factor !== undefined ? v * def.factor : v)) flags.push('IMPOSSIBLE_VALUE')

  if (def.category === 'PERCENT_UNKNOWN_BASIS') flags.push('AMBIGUOUS_PERCENTAGE')
  if (def.category === 'PPM' || def.category === 'PPB') flags.push('UNKNOWN_BASIS')
  if (flags.includes('IMPOSSIBLE_VALUE')) return base

  // Values with an unknown basis are kept in their original unit — converting them would invent a basis.
  if (def.category === 'PERCENT_UNKNOWN_BASIS' || def.category === 'PPM' || def.category === 'PPB') {
    base.normalizedUnit = def.canonical
    base.conversionMethod = 'none (basis unknown)'
    if (parsed.isRange) { base.normalizedMin = parsed.min; base.normalizedMax = parsed.max } else base.normalizedValue = parsed.value
    return base
  }
  try {
    base.normalizedUnit = def.canonical
    base.conversionMethod = def.factor !== undefined ? `factor ${def.factor}` : `mathjs ${def.math} → ${def.canonical}`
    if (parsed.isRange) {
      base.normalizedMin = round(convert(parsed.min!, def))
      base.normalizedMax = round(convert(parsed.max!, def))
    } else base.normalizedValue = round(convert(parsed.value!, def))
  } catch {
    flags.push('UNSUPPORTED_CONVERSION')
    base.normalizedUnit = null
    base.conversionMethod = null
  }
  return base
}
