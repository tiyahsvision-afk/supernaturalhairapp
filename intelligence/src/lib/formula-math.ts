// Formula mathematics. All arithmetic is done in integer micro-percent (1e-5 %) to avoid floating-point drift.
// Distinguishes raw-material use level (as supplied) from ingredient active level.

const SCALE = 100_000

export interface FormulaLineInput {
  id?: string
  displayName: string
  percent: number | null // as-supplied use level, % w/w
  isQs: boolean
  phase?: string | null
  rawMaterialActivePercent?: number | null
  rawMaterialActiveConfirmed?: boolean
}

export interface FormulaValidation {
  valid: boolean
  total: number // sum of explicit percentages
  qsAmount: number | null // computed amount for the single q.s. line
  errors: string[]
  warnings: string[]
  phaseTotals: Record<string, number>
  activeLevels: { id?: string; displayName: string; activePercent: number | null; reason: string }[]
}

const toInt = (n: number) => Math.round(n * SCALE)
const fromInt = (n: number) => n / SCALE

export function validateFormula(lines: FormulaLineInput[], tolerance = 0.001): FormulaValidation {
  const errors: string[] = []
  const warnings: string[] = []
  const qsLines = lines.filter((l) => l.isQs)
  if (lines.length === 0) errors.push('Formula has no ingredients.')
  if (qsLines.length > 1) errors.push('Only one q.s. ingredient is allowed per formula version.')
  let totalInt = 0
  for (const l of lines) {
    if (l.isQs) {
      if (l.percent !== null && l.percent !== undefined) warnings.push(`"${l.displayName}" is q.s.; its entered percentage is ignored and recomputed.`)
      continue
    }
    if (l.percent === null || l.percent === undefined || Number.isNaN(l.percent)) {
      errors.push(`"${l.displayName}" has no percentage.`)
      continue
    }
    if (l.percent < 0 || l.percent > 100) errors.push(`"${l.displayName}" percentage ${l.percent} is outside 0–100.`)
    totalInt += toInt(l.percent)
  }
  const tolInt = toInt(tolerance)
  let qsAmount: number | null = null
  if (qsLines.length === 1) {
    const rem = toInt(100) - totalInt
    if (rem < 0) errors.push(`Explicit percentages total ${fromInt(totalInt)}%, leaving no room for q.s.`)
    else qsAmount = fromInt(rem)
  } else if (qsLines.length === 0 && Math.abs(totalInt - toInt(100)) > tolInt) {
    errors.push(`Percentages total ${fromInt(totalInt)}%, not 100% (tolerance ±${tolerance}%).`)
  }
  const phaseTotals: Record<string, number> = {}
  for (const l of lines) {
    const p = l.phase || 'Unassigned'
    const pct = l.isQs ? (qsAmount ?? 0) : (l.percent ?? 0)
    phaseTotals[p] = fromInt((toInt(phaseTotals[p] ?? 0)) + toInt(pct))
  }
  const activeLevels = lines.map((l) => {
    const use = l.isQs ? qsAmount : l.percent
    if (l.rawMaterialActivePercent == null) return { id: l.id, displayName: l.displayName, activePercent: null, reason: 'No raw-material active % recorded.' }
    if (!l.rawMaterialActiveConfirmed) return { id: l.id, displayName: l.displayName, activePercent: null, reason: 'Raw-material active % not confirmed by supplier documentation.' }
    if (use == null) return { id: l.id, displayName: l.displayName, activePercent: null, reason: 'Use level unknown.' }
    return { id: l.id, displayName: l.displayName, activePercent: activeConcentration(use, l.rawMaterialActivePercent), reason: 'Use level × confirmed active %.' }
  })
  return { valid: errors.length === 0, total: fromInt(totalInt), qsAmount, errors, warnings, phaseTotals, activeLevels }
}

/** Example: a raw material that is 50% active used at 4% contributes 2% active. */
export function activeConcentration(usePercent: number, activePercent: number): number {
  return fromInt(Math.round((toInt(usePercent) * toInt(activePercent)) / toInt(100)))
}

/** Scales a validated formula to a batch size; returns quantities in the batch unit. */
export function scaleBatch(lines: { displayName: string; percent: number }[], batchSize: number, lossPercent = 0) {
  if (batchSize <= 0) throw new Error('Batch size must be positive.')
  if (lossPercent < 0 || lossPercent >= 100) throw new Error('Manufacturing loss must be between 0 and 100%.')
  const gross = batchSize / (1 - lossPercent / 100)
  return lines.map((l) => ({ displayName: l.displayName, percent: l.percent, quantity: Number(((gross * l.percent) / 100).toFixed(6)) }))
}

export interface CompareLine { key: string; displayName: string; percent: number | null; isQs: boolean }

/** Side-by-side diff of two formula versions keyed by ingredient/raw material. */
export function compareVersions(a: CompareLine[], b: CompareLine[]) {
  const keys = [...new Set([...a.map((l) => l.key), ...b.map((l) => l.key)])]
  return keys.map((key) => {
    const la = a.find((l) => l.key === key)
    const lb = b.find((l) => l.key === key)
    const status = !la ? 'ADDED' : !lb ? 'REMOVED' : la.percent !== lb.percent || la.isQs !== lb.isQs ? 'CHANGED' : 'SAME'
    return { key, displayName: (lb ?? la)!.displayName, before: la?.percent ?? null, after: lb?.percent ?? null, beforeQs: la?.isQs ?? false, afterQs: lb?.isQs ?? false, status }
  })
}
