// Evidence-quality rubric (separate from the evidence ladder, which describes evidence TYPE).
// Scores: 0 = weak/absent, 1 = partial, 2 = strong, null = not applicable. Final grade must be set by a reviewer.
export const RUBRIC_VERSION = 'evidence-rubric-0.1.0-draft'

export const CRITERIA: { key: string; label: string; guidance: string }[] = [
  { key: 'design', label: 'Study design', guidance: 'Controlled human > controlled lab > observational > case report.' },
  { key: 'sampleSize', label: 'Sample size', guidance: 'Adequate for the outcome and stated power; tiny pilots score 0.' },
  { key: 'control', label: 'Control quality', guidance: 'Appropriate vehicle/placebo or comparator.' },
  { key: 'randomization', label: 'Randomization', guidance: 'Randomized allocation with concealment.' },
  { key: 'blinding', label: 'Blinding', guidance: 'Participants and assessors blinded.' },
  { key: 'population', label: 'Population relevance', guidance: 'Population matches the question (age, sex, ancestry, hair type).' },
  { key: 'hairPhenotype', label: 'Hair-phenotype relevance', guidance: 'Hair fiber type/condition matches (e.g. textured, chemically treated).' },
  { key: 'scalpPhenotype', label: 'Scalp-phenotype relevance', guidance: 'Scalp condition matches; medical conditions are not cosmetic phenotypes.' },
  { key: 'formula', label: 'Formula relevance', guidance: 'Vehicle and product type comparable to intended use.' },
  { key: 'identity', label: 'Ingredient identity certainty', guidance: 'Exact INCI/material/grade reported.' },
  { key: 'concentration', label: 'Concentration certainty', guidance: 'Concentration and basis reported.' },
  { key: 'exposure', label: 'Exposure certainty', guidance: 'Dose, frequency, contact time, rinse-off/leave-on reported.' },
  { key: 'duration', label: 'Duration', guidance: 'Long enough for the outcome (hair growth cycles are months).' },
  { key: 'adherence', label: 'Adherence', guidance: 'Adherence measured and reported.' },
  { key: 'objectivity', label: 'Outcome objectivity', guidance: 'Instrumental/standardized > graded > self-report.' },
  { key: 'validation', label: 'Measurement validation', guidance: 'Validated methods or instruments.' },
  { key: 'statistics', label: 'Statistical quality', guidance: 'Pre-specified analysis, effect sizes, CIs, multiplicity handled.' },
  { key: 'missing', label: 'Missing data', guidance: 'Low attrition; missing data handled appropriately.' },
  { key: 'replication', label: 'Replication', guidance: 'Independently replicated findings.' },
  { key: 'directness', label: 'Directness', guidance: 'Measures the outcome of interest directly (not a surrogate).' },
  { key: 'publication', label: 'Publication status', guidance: 'Peer-reviewed > preprint > conference > unpublished.' },
  { key: 'funding', label: 'Funding source', guidance: 'Independent funding, or industry funding with safeguards.' },
  { key: 'coi', label: 'Conflict of interest', guidance: 'COI declared and managed.' },
  { key: 'reporting', label: 'Reporting completeness', guidance: 'Methods sufficient to reproduce.' },
]

export type QualityCat = 'VERY_LOW' | 'LOW' | 'MODERATE' | 'HIGH' | 'NOT_YET_ASSESSED'

/** Preliminary category from rubric scores. Never final: a reviewer must confirm or adjust with a reason. */
export function preliminaryCategory(scores: Record<string, number | null>): QualityCat {
  const vals = Object.values(scores).filter((v): v is number => v !== null && v !== undefined)
  if (vals.length < 8) return 'NOT_YET_ASSESSED'
  const r = vals.reduce((a, b) => a + b, 0) / (vals.length * 2)
  return r >= 0.75 ? 'HIGH' : r >= 0.5 ? 'MODERATE' : r >= 0.3 ? 'LOW' : 'VERY_LOW'
}

export const LEVELS: Record<number, string> = { 1: 'Consumer self-report', 2: 'Longitudinal observational association', 3: 'Standardized image or measurement signal', 4: 'Professional observation', 5: 'Controlled laboratory evidence', 6: 'Controlled human study', 7: 'Independent replication / strong supporting evidence' }
