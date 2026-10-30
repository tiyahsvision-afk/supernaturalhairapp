// Shared result shape for every research workflow, so projects, history and reports render uniformly.
import type { DataStatus } from '../dimensions'

export const ENGINE_VERSION = 'workbench/1.0.0'

export type Certainty = 'ESTABLISHED' | 'SUPPORTED' | 'UNCERTAIN' | 'UNSUPPORTED' | 'NEEDS_TESTING' | 'REVIEW_REQUIRED' | 'INFO'

export const CERTAINTY_META: Record<Certainty, { label: string; help: string; tone: 'good' | 'info' | 'warn' | 'bad' | 'neutral' }> = {
  ESTABLISHED: { label: 'Established', help: 'Backed by a reviewed record or an official source.', tone: 'good' },
  SUPPORTED: { label: 'Some support', help: 'Source-backed records exist but have not been reviewed by a qualified person.', tone: 'info' },
  UNCERTAIN: { label: 'Uncertain', help: 'Evidence is indirect, preliminary, conflicting or unreviewed.', tone: 'warn' },
  UNSUPPORTED: { label: 'Not supported', help: 'No supporting record was found in the database.', tone: 'bad' },
  NEEDS_TESTING: { label: 'Needs lab testing', help: 'Only experimental work in the target formulation can answer this.', tone: 'warn' },
  REVIEW_REQUIRED: { label: 'Specialist review', help: 'Requires a qualified regulatory, safety or IP professional.', tone: 'bad' },
  INFO: { label: 'Context', help: 'Background or method information.', tone: 'neutral' },
}

export interface Citation {
  id: string // stable key within the result, e.g. "ing:<uuid>"
  kind: 'ingredient' | 'evidence' | 'regulatory' | 'patent' | 'product' | 'raw_material' | 'supplier' | 'source' | 'formula' | 'official'
  label: string
  href?: string
  note?: string
}

export interface Cell { text: string; status?: DataStatus; href?: string }

export interface ResultTable { title: string; caption?: string; columns: string[]; rows: (string | Cell)[][] }

export interface Finding { title: string; detail: string; certainty: Certainty; citations: string[] }

export interface WorkflowResult {
  headline: string
  summary: string
  findings: Finding[]
  tables: ResultTable[]
  openQuestions: string[]
  nextSteps: string[]
  limitations: string[]
  methodology: string
  citations: Citation[]
  verification: Partial<Record<DataStatus, number>>
}

export function citeIngredient(i: { id: string; displayName: string; inciName?: string | null }): Citation {
  return { id: `ing:${i.id}`, kind: 'ingredient', label: i.inciName && i.inciName !== i.displayName ? `${i.displayName} (INCI: ${i.inciName})` : i.displayName, href: `/ingredients/${i.id}` }
}
export function citeEvidence(e: { id: string; title: string; pmid?: string | null }): Citation {
  return { id: `ev:${e.id}`, kind: 'evidence', label: `${e.title}${e.pmid ? ` (PMID ${e.pmid})` : ''}`, href: `/evidence/${e.id}` }
}

export const STANDARD_LIMITATIONS = [
  'Research decision support only. Not a finished, safety-tested formulation, a safety assessment, regulatory approval or legal advice.',
  'Shared official functions and similar classifications do not mean equivalent performance; only testing in the target formulation can establish that.',
  'Records marked unreviewed, rule-derived or hypothesis have not been verified by a qualified professional.',
]

/** Typical laboratory checks to plan, keyed by official CosIng function. Considerations, not test results. */
export const TESTS_BY_FUNCTION: Record<string, string[]> = {
  'hair-conditioning': ['Wet and dry combing force (instrumental) or trained sensory panel on tresses', 'Build-up after repeated application'],
  antistatic: ['Static/fly-away assessment on dry tresses'],
  surfactant: ['Foam volume and stability', 'Viscosity response to salt and pH', 'Mildness screening appropriate to the product type'],
  cleansing: ['Cleansing efficacy on sebum-soiled tresses', 'Foam and rinse profile'],
  emulsifying: ['Emulsion stability (temperature cycling, centrifuge, accelerated storage)', 'Droplet size / appearance over time'],
  'viscosity-controlling': ['Rheology/viscosity across the target pH and temperature range'],
  preservative: ['Preservative efficacy (challenge) test, e.g. ISO 11930, in the final formula and packaging'],
  humectant: ['Tack/stickiness assessment', 'Performance at low and high relative humidity'],
  emollient: ['Spreadability and residue (sensory)', 'Oxidative stability if unsaturated'],
  'film-forming': ['Hold, flake and humidity resistance on styled tresses'],
  'skin-conditioning': ['Scalp feel and residue (sensory panel)'],
  buffering: ['pH drift over storage'],
  chelating: ['Hard-water performance and colour/odour stability'],
  perfuming: ['Odour stability and fragrance–base compatibility', 'Allergen declaration under target-market rules'],
  antioxidant: ['Rancidity/oxidation markers over storage'],
}

export const ALWAYS_TEST = ['Stability under accelerated and real-time conditions in the final packaging', 'Compatibility with packaging', 'Safety assessment of the finished product by a qualified safety assessor']

export function testsFor(functions: string[]): string[] {
  const out = new Set<string>()
  for (const f of functions) for (const t of TESTS_BY_FUNCTION[f] ?? []) out.add(t)
  return [...out]
}
