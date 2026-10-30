// Workflow C — investigate a product claim.
//
// Screens the claim wording (cosmetic vs potential drug/systemic claim, proof and absolute-safety language), maps it to
// hair/scalp outcome terms and to the ingredients it relies on, retrieves evidence from the database, and grades each
// ingredient × outcome element. Evidence classifications marked AI-proposed have not been reviewed, so they cannot make
// a claim "supported" on their own.
import type { StudyType } from '@prisma/client'
import { prisma } from '../db'
import { screenClaimText } from '../claims-guard'
import { normalizeName } from '../normalize'
import type { Principal } from '../permissions'
import { cachedNameIndex, matchName } from '../services/matching'
import { ENGINE_VERSION, STANDARD_LIMITATIONS, citeEvidence, citeIngredient, type Certainty, type Citation, type Finding, type WorkflowResult } from './types'

export interface ClaimInput { claim: string; ingredientIds?: string[]; applicationType?: 'RINSE_OFF' | 'LEAVE_ON' | 'UNKNOWN'; markets?: string[] }

// Claim vocabulary → outcome terms in the hair/scalp ontology (ii-hair-scalp, draft).
const OUTCOME_WORDS: [RegExp, string][] = [
  [/breakage|break(s|ing)?\b|snap/i, 'breakage'], [/moistur|hydrat|dry(ness)? hair/i, 'moisture-retention'], [/frizz|humidity|flyaway/i, 'frizz-response'],
  [/shrinkage/i, 'shrinkage'], [/length|retention|longer/i, 'length-retention'], [/elastic|stretch/i, 'elasticity'], [/strength|strong|stronger|tensile/i, 'tensile-behavior'],
  [/dry scalp|itchy scalp|scalp dryness|tight scalp/i, 'scalp-dryness'], [/flak|dandruff/i, 'visible-flaking'], [/oily scalp|sebum|greasy/i, 'scalp-oiliness'], [/build-?up|residue|clarif/i, 'buildup'],
  [/thick|full(er|ness)|density|volume/i, 'apparent-density-change'], [/edges|hairline/i, 'hairline-observations'], [/growth|grow|regrow|hair loss|thinning|shedding/i, 'apparent-density-change'],
  [/curl|coil|definition|wave/i, 'curl-geometry'], [/porosity/i, 'apparent-porosity'], [/sensitiv|irritat|sooth|calm/i, 'scalp-sensitivity'], [/redness/i, 'visible-redness'],
  [/heat|thermal|flat ?iron|blow-?dry/i, 'heat-damage'], [/colou?r|bleach|dye/i, 'color-treated-hair'], [/relax|perm|chemical/i, 'chemical-damage'], [/detangl|comb|knot|tangle/i, 'mechanical-damage'],
]

const STUDY_GROUP: Record<StudyType, string> = {
  CONTROLLED_HUMAN: 'Controlled human study', HUMAN_OBSERVATIONAL: 'Human observational', META_ANALYSIS: 'Meta-analysis', SYSTEMATIC_REVIEW: 'Systematic review', REVIEW: 'Narrative review',
  PEER_REVIEWED_STUDY: 'Peer-reviewed study (design unclassified)', IN_VITRO: 'In vitro', EX_VIVO: 'Ex vivo (hair fibres / tresses)', ANIMAL: 'Animal study', PROFESSIONAL_CONSENSUS: 'Professional consensus',
  REGULATORY_ASSESSMENT: 'Regulatory / safety assessment', SUPPLIER_STUDY: 'Supplier-sponsored study', INTERNAL_STUDY: 'Internal study', CASE_REPORT: 'Case report', PATENT_EXAMPLE: 'Patent example', OTHER: 'Other',
}
const HUMAN: StudyType[] = ['CONTROLLED_HUMAN', 'HUMAN_OBSERVATIONAL', 'META_ANALYSIS', 'SYSTEMATIC_REVIEW']

export function mapOutcomes(claim: string): string[] {
  return [...new Set(OUTCOME_WORDS.filter(([re]) => re.test(claim)).map(([, code]) => code))]
}

/** Finds ingredient names mentioned in free text by exact match of 1–5 word windows against the name index. */
export async function ingredientsInText(text: string): Promise<string[]> {
  const idx = await cachedNameIndex()
  const words = normalizeName(text).split(/\s+/).filter(Boolean)
  const found = new Set<string>()
  for (let n = 5; n >= 1; n--) {
    for (let i = 0; i + n <= words.length; i++) {
      const phrase = words.slice(i, i + n).join(' ')
      if (phrase.length < 4) continue
      const m = matchName(idx, phrase)
      if (m.status === 'MATCHED' && m.ingredientId && m.confidence >= 0.9) found.add(m.ingredientId)
    }
  }
  return [...found]
}

export async function runClaim(principal: Principal, input: ClaimInput): Promise<WorkflowResult> {
  void principal
  const claim = input.claim.trim()
  if (claim.length < 5) throw new Error('Enter the claim wording to investigate.')
  const flags = screenClaimText(claim)
  const outcomes = mapOutcomes(claim)
  const ingredientIds = [...new Set([...(input.ingredientIds ?? []), ...(await ingredientsInText(claim))])]
  const [terms, ings] = await Promise.all([
    prisma.ontologyTerm.findMany({ where: { code: { in: outcomes } } }),
    prisma.ingredient.findMany({ where: { id: { in: ingredientIds } }, select: { id: true, displayName: true, inciName: true } }),
  ])
  const citations: Citation[] = [
    { id: 'official:eu-655-2013', kind: 'official', label: 'Commission Regulation (EU) No 655/2013 — common criteria for the justification of claims used in relation to cosmetic products', href: 'https://eur-lex.europa.eu/eli/reg/2013/655/oj' },
    { id: 'official:fda-cosmetic-or-drug', kind: 'official', label: 'U.S. FDA — Is it a cosmetic, a drug, or both? (intended-use guidance)', href: 'https://www.fda.gov/cosmetics/cosmetics-laws-regulations/it-cosmetic-drug-or-both-or-it-soap' },
    ...ings.map(citeIngredient),
  ]
  const termIds = terms.map((t) => t.id)
  const links = await prisma.evidenceLink.findMany({
    where: { OR: [...(ingredientIds.length ? [{ ingredientId: { in: ingredientIds } }] : []), ...(termIds.length ? [{ ontologyTermId: { in: termIds } }] : [])] },
    include: { evidence: true, ontologyTerm: true, ingredient: { select: { id: true, displayName: true } } },
  })
  // Group by evidence record: which ingredients and which outcomes it links.
  const byEv = new Map<string, { ev: (typeof links)[number]['evidence']; ingIds: Set<string>; termCodes: Set<string>; direction: Set<string> }>()
  for (const l of links) {
    const g = byEv.get(l.evidenceId) ?? { ev: l.evidence, ingIds: new Set(), termCodes: new Set(), direction: new Set() }
    if (l.ingredientId) g.ingIds.add(l.ingredientId)
    if (l.ontologyTerm) g.termCodes.add(l.ontologyTerm.code)
    g.direction.add(l.direction)
    byEv.set(l.evidenceId, g)
  }
  const relevant = [...byEv.values()].filter((g) => (!ingredientIds.length || [...g.ingIds].some((i) => ingredientIds.includes(i))) && (!outcomes.length || [...g.termCodes].some((c) => outcomes.includes(c)) || g.termCodes.size === 0))
  for (const g of relevant) citations.push(citeEvidence(g.ev))

  const findings: Finding[] = []
  const drug = flags.filter((f) => f.category === 'DRUG_OR_MEDICAL' || f.category === 'SYSTEMIC_EFFECT')
  if (drug.length) findings.push({ title: 'Potential drug or medicinal claim', detail: `Wording such as ${drug.map((f) => `“${f.term}”`).join(', ')} suggests treating, preventing or affecting body structure or function. In the US and EU this can make a product a drug/medicinal product regardless of its ingredients. Requires specialist regulatory review before any use.`, certainty: 'REVIEW_REQUIRED', citations: ['official:fda-cosmetic-or-drug', 'official:eu-655-2013'] })
  for (const f of flags.filter((x) => x.category === 'PROOF_LANGUAGE')) findings.push({ title: `Proof language: “${f.term}”`, detail: 'Requires substantiation proportionate to the claim (typically controlled testing of the finished product), and must not overstate results.', certainty: 'REVIEW_REQUIRED', citations: ['official:eu-655-2013'] })
  for (const f of flags.filter((x) => x.category === 'REGULATORY_STATUS' || x.category === 'SAFETY_ABSOLUTE')) findings.push({ title: `Problematic wording: “${f.term}”`, detail: f.category === 'REGULATORY_STATUS' ? 'Cosmetics are not generally “approved” before sale in the US or EU; such wording is likely misleading.' : 'Absolute safety claims cannot be substantiated.', certainty: 'REVIEW_REQUIRED', citations: ['official:eu-655-2013'] })
  if (!flags.length) findings.push({ title: 'No high-risk wording detected by the screen', detail: 'The automated screen found no drug, proof or absolute-safety wording. It is a screening aid, not a legal review; context and imagery also matter.', certainty: 'INFO', citations: [] })

  // Element grading
  const grade = (evs: typeof relevant): { certainty: Certainty; why: string } => {
    const usable = evs.filter((g) => !g.ev.medicalContext)
    const reviewedHumanSupport = usable.filter((g) => g.ev.reviewStatus === 'APPROVED' && HUMAN.includes(g.ev.studyType) && g.direction.has('SUPPORTS'))
    if (reviewedHumanSupport.length) return { certainty: 'SUPPORTED', why: `${reviewedHumanSupport.length} reviewed human study/studies report support.` }
    if (usable.some((g) => g.direction.has('SUPPORTS'))) return { certainty: 'UNCERTAIN', why: 'Supporting records exist but are unreviewed, non-human or of unclassified design.' }
    if (evs.length) return { certainty: 'UNCERTAIN', why: evs.every((g) => g.ev.medicalContext) ? 'Only medical-context studies — these cannot support a cosmetic claim.' : 'Records exist but do not report support.' }
    return { certainty: 'UNSUPPORTED', why: 'No linked evidence in the database.' }
  }
  const elements: string[][] = []
  const targets = ings.length ? ings : [{ id: '', displayName: '(no ingredient named)', inciName: null }]
  const outs = outcomes.length ? outcomes : ['(no outcome recognised)']
  for (const i of targets) for (const o of outs) {
    const evs = relevant.filter((g) => (!i.id || g.ingIds.has(i.id)) && (o.startsWith('(') || g.termCodes.has(o)))
    const gr = grade(evs)
    elements.push([i.displayName, o.replace(/-/g, ' '), gr.certainty, gr.why, String(evs.length)])
    findings.push({ title: `${i.displayName} → ${o.replace(/-/g, ' ')}`, detail: gr.why, certainty: gr.certainty, citations: [...(i.id ? [`ing:${i.id}`] : []), ...evs.map((g) => `ev:${g.ev.id}`)] })
  }
  const unreviewed = relevant.filter((g) => g.ev.reviewStatus !== 'APPROVED').length
  const overall = drug.length ? 'needs specialist regulatory review before anything else' : elements.some((e) => e[2] === 'SUPPORTED') ? 'is partly supported by reviewed evidence' : relevant.length ? 'is not yet supported: evidence exists but is unreviewed, indirect or preliminary' : 'is unsupported by evidence in the database'
  return {
    headline: `Claim investigation: “${claim}”`,
    summary: `This claim ${overall}. ${relevant.length} relevant evidence record(s) found (${unreviewed} not yet reviewed). Outcomes recognised: ${outcomes.map((o) => o.replace(/-/g, ' ')).join(', ') || 'none'}. Ingredients: ${ings.map((i) => i.displayName).join(', ') || 'none named'}. Claim support for a product ultimately requires evidence on the finished product.`,
    findings,
    tables: [
      { title: 'Claim elements', caption: 'Each ingredient × outcome pair graded from evidence in the database.', columns: ['Ingredient', 'Outcome', 'Assessment', 'Why', 'Records'], rows: elements },
      { title: 'Evidence considered', caption: 'Study design and review status are shown separately; AI-proposed classifications are unreviewed.', columns: ['Record', 'Design', 'Level', 'Review status', 'Direction', 'Medical context'], rows: relevant.map((g) => [{ text: g.ev.title, href: `/evidence/${g.ev.id}` }, STUDY_GROUP[g.ev.studyType], g.ev.evidenceLevel ? String(g.ev.evidenceLevel) : 'unrated', g.ev.reviewStatus.toLowerCase(), [...g.direction].join(', ').toLowerCase(), g.ev.medicalContext ? 'yes — cannot support cosmetic claims' : 'no']) },
    ],
    openQuestions: ['Will the claim be supported by testing of the finished product (instrumental, consumer or expert-graded)?', 'Which markets will the claim appear in, and in what context (label, website, social, imagery)?', ...(drug.length ? ['Can the intended message be expressed as a cosmetic (appearance/feel) claim instead?'] : [])],
    nextSteps: ['Have a qualified reviewer grade the evidence records listed above.', 'Design claim-substantiation testing on the finished product.', 'Obtain regulatory review of the final wording for each market.'],
    limitations: [...STANDARD_LIMITATIONS, 'Outcome recognition uses a keyword map to a draft hair/scalp ontology and may miss or misread claim elements.', 'Ingredient-level evidence does not substantiate a claim for a finished product on its own.'],
    methodology: `Claim screened with the claims guard (drug/medicinal, systemic, proof, regulatory-status and absolute-safety wording). Outcomes recognised by keyword mapping to the ii-hair-scalp ontology; ingredients from user selection plus exact name matches in the claim. Evidence = records linked to those ingredients and/or outcomes. Element grading: SUPPORTED only with reviewed human studies reporting support; medical-context studies never support cosmetic claims. Engine ${ENGINE_VERSION}.`,
    citations, verification: { VERIFIED: relevant.filter((g) => g.ev.reviewStatus === 'APPROVED').length, HYPOTHESIS: unreviewed },
  }
}
