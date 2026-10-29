import type { EntryMode, Prisma, PropertyType } from '@prisma/client'
import { prisma } from '../db'
import { audit } from '../audit'
import type { Principal } from '../permissions'
import { normalizeMeasurement, type MeasurementCategory } from '../units'

const NUMERIC_CATEGORY: Partial<Record<PropertyType, MeasurementCategory>> = {
  MOLECULAR_WEIGHT: 'MOLECULAR_WEIGHT', EXACT_MASS: 'MOLECULAR_WEIGHT', MELTING_POINT: 'TEMPERATURE', BOILING_POINT: 'TEMPERATURE',
  DENSITY: 'DENSITY', VISCOSITY: 'VISCOSITY', PROCESSING_TEMPERATURE: 'TEMPERATURE', PH_RANGE: 'PH',
}

export interface FactInput {
  ingredientId: string
  propertyType: PropertyType
  value: string
  unit?: string | null
  sourceId: string
  sourceLocation?: string
  entryMode: EntryMode
  confidence?: number
  testConditions?: string
  temperatureC?: number
  phConditions?: string
  medium?: string
  formulationContext?: string
  jurisdiction?: string
  quotedText?: string
  extractionMethod?: string
  effectiveDate?: Date
}

/**
 * Creates a fact. Facts are never overwritten. If another current fact for the same property exists with a different
 * value, both are kept and a conflict is recorded (visible in the conflict view and the review queue).
 */
export async function createFact(actor: Principal | null, input: FactInput, tx: Prisma.TransactionClient | typeof prisma = prisma) {
  const expected = NUMERIC_CATEGORY[input.propertyType]
  const isNumeric = /^\s*-?\d/.test(input.value) && (expected || input.unit)
  const norm = isNumeric ? normalizeMeasurement(input.value, input.unit, expected) : null
  const numeric = isNumeric ? Number(input.value.replace(/,/g, '')) : null
  const range = isNumeric ? /^(-?\d*\.?\d+)\s*(?:-|–|to)\s*(-?\d*\.?\d+)$/.exec(input.value.trim()) : null
  const data: Prisma.IngredientFactUncheckedCreateInput = {
    ingredientId: input.ingredientId,
    propertyType: input.propertyType,
    valueText: isNumeric ? null : input.value,
    originalValue: input.value,
    originalUnit: input.unit ?? null,
    valueNumeric: range ? null : numeric !== null && !Number.isNaN(numeric) ? numeric : null,
    valueMin: range ? Number(range[1]) : null,
    valueMax: range ? Number(range[2]) : null,
    isRange: Boolean(range),
    normalizedValue: norm?.normalizedValue ?? null,
    normalizedMin: norm?.normalizedMin ?? null,
    normalizedMax: norm?.normalizedMax ?? null,
    normalizedUnit: norm?.normalizedUnit ?? null,
    conversionMethod: norm?.conversionMethod ?? null,
    conversionVersion: norm?.conversionVersion ?? null,
    significantFigures: norm?.significantFigures ?? null,
    qualityFlags: norm?.flags ?? [],
    testConditions: input.testConditions,
    temperatureC: input.temperatureC,
    phConditions: input.phConditions,
    medium: input.medium,
    formulationContext: input.formulationContext,
    jurisdiction: input.jurisdiction,
    sourceId: input.sourceId,
    sourceLocation: input.sourceLocation,
    quotedText: input.quotedText,
    extractionMethod: input.extractionMethod,
    entryMode: input.entryMode,
    confidence: input.confidence,
    effectiveDate: input.effectiveDate,
    createdById: actor?.kind === 'USER' ? actor.id : null,
    reviewStatus: 'SUBMITTED',
  }
  const fact = await tx.ingredientFact.create({ data })
  await audit(actor, { action: 'fact.create', entityType: 'IngredientFact', entityId: fact.id, after: data, sourceId: input.sourceId }, tx)
  if (norm?.flags.length) {
    await tx.quarantineItem.create({
      data: {
        queue: norm.flags.includes('IMPOSSIBLE_VALUE') ? 'IMPOSSIBLE_VALUE' : 'MISSING_UNIT',
        entityType: 'IngredientFact', entityId: fact.id, payload: { flags: norm.flags, value: input.value, unit: input.unit ?? null },
        reason: `Measurement flags: ${norm.flags.join(', ')}`,
      },
    }).catch(() => undefined)
  }
  return fact
}

/** Supersedes a fact with a corrected version; the prior version remains readable in history. */
export async function supersedeFact(actor: Principal, factId: string, replacement: FactInput, reason: string) {
  return prisma.$transaction(async (tx) => {
    const old = await tx.ingredientFact.findUniqueOrThrow({ where: { id: factId } })
    if (old.supersededAt) throw new Error('Fact already superseded.')
    const created = await createFact(actor, replacement, tx)
    await tx.ingredientFact.update({ where: { id: factId }, data: { supersededAt: new Date(), supersededById: created.id, reviewStatus: 'SUPERSEDED' } })
    await audit(actor, { action: 'fact.supersede', entityType: 'IngredientFact', entityId: factId, before: old, after: { supersededById: created.id }, reason }, tx)
    return created
  })
}

/** Groups current facts by property and marks properties where sources disagree. */
export function detectConflicts<T extends { propertyType: string; normalizedValue: unknown; valueText: string | null; originalValue: string | null; normalizedUnit: string | null; supersededAt: Date | null; medium?: string | null; testConditions?: string | null }>(facts: T[]) {
  const groups = new Map<string, T[]>()
  for (const f of facts.filter((x) => !x.supersededAt)) {
    const arr = groups.get(f.propertyType) ?? []
    arr.push(f)
    groups.set(f.propertyType, arr)
  }
  return [...groups.entries()].map(([propertyType, list]) => {
    const keys = new Set(list.map((f) => (f.normalizedValue != null ? `${Number(f.normalizedValue).toPrecision(4)} ${f.normalizedUnit}` : (f.valueText ?? f.originalValue ?? '').toLowerCase())))
    return { propertyType, facts: list, conflict: keys.size > 1 }
  })
}
