// Completeness measures how many source-backed fields are populated. It is NOT a measure of scientific quality,
// evidence strength or safety.

const IDENTIFIER_APPLICABLE = new Set(['DEFINED_SUBSTANCE', 'SALT', 'ESTER', 'ISOMER', 'DERIVATIVE'])
const COMPLEX = new Set(['BOTANICAL_EXTRACT', 'BOTANICAL_FRACTION', 'ESSENTIAL_OIL', 'FIXED_OIL', 'WAX', 'FERMENT', 'LYSATE', 'FILTRATE', 'HYDROLYSATE', 'UVCB', 'UNKNOWN_COMPOSITION', 'OTHER_COMPLEX', 'PROPRIETARY_BLEND', 'RAW_MATERIAL_BLEND'])

export interface CompletenessInput {
  identityType: string
  inciName: string | null
  description: string | null
  familyId: string | null
  verifiedIdentifierCount: number
  functionCount: number
  factCount: number
  regulatoryJurisdictions: number
  safetyReviewCount: number
  evidenceCount: number
  concentrationCount: number
  hasComplexProfile: boolean
}

export interface CompletenessItem { key: string; label: string; present: boolean; applicable: boolean }

export function computeCompleteness(i: CompletenessInput): { score: number; items: CompletenessItem[] } {
  const items: CompletenessItem[] = [
    { key: 'inci', label: 'INCI name', present: Boolean(i.inciName), applicable: true },
    { key: 'family', label: 'Ingredient family', present: Boolean(i.familyId), applicable: true },
    { key: 'description', label: 'Description', present: Boolean(i.description), applicable: true },
    { key: 'identifier', label: 'Verified chemical identifier', present: i.verifiedIdentifierCount > 0, applicable: IDENTIFIER_APPLICABLE.has(i.identityType) },
    { key: 'complex', label: 'Complex-material profile (source, part, process)', present: i.hasComplexProfile, applicable: COMPLEX.has(i.identityType) },
    { key: 'function', label: 'Cosmetic function', present: i.functionCount > 0, applicable: true },
    { key: 'facts', label: 'Property facts', present: i.factCount > 0, applicable: true },
    { key: 'regulatory', label: 'Regulatory record (≥1 jurisdiction)', present: i.regulatoryJurisdictions > 0, applicable: true },
    { key: 'regulatory2', label: 'Regulatory records (≥2 jurisdictions)', present: i.regulatoryJurisdictions > 1, applicable: true },
    { key: 'safety', label: 'Safety review record', present: i.safetyReviewCount > 0, applicable: true },
    { key: 'evidence', label: 'Linked evidence', present: i.evidenceCount > 0, applicable: true },
    { key: 'concentration', label: 'Concentration record', present: i.concentrationCount > 0, applicable: true },
  ]
  const applicable = items.filter((x) => x.applicable)
  const score = Math.round((applicable.filter((x) => x.present).length / applicable.length) * 100)
  return { score, items }
}
