// Founder workspace — Product Development Research Brief (from the 10-question wizard).
//
// Produces a structured research brief: functional building blocks typical of the product category, candidate
// ingredients to research for each (filtered by the founder's preferences), relevant evidence for the stated concerns,
// claim-wording screening, market regulatory starting points, manufacturer preparation and a roadmap.
// It does not produce a formula, percentages or costs, and says so.
import { prisma } from '../db'
import { screenClaimText } from '../claims-guard'
import type { Principal } from '../permissions'
import { cachedNameIndex, matchName } from '../services/matching'
import { ENGINE_VERSION, STANDARD_LIMITATIONS, citeEvidence, citeIngredient, type Citation, type Finding, type WorkflowResult } from './types'
import { mapOutcomes } from './claim'

export interface BriefInput {
  category: string
  targetCustomer: string
  performance: string
  concerns: string[]
  preferences: string[]
  investigate: string
  avoid: string
  texture: string
  markets: string[]
  retailPrice: string
  constraints: string
}

export const CATEGORIES: Record<string, { label: string; application: 'RINSE_OFF' | 'LEAVE_ON'; aqueous: boolean; blocks: { role: string; fns: string[]; classes?: string[]; note?: string }[] }> = {
  shampoo: { label: 'Shampoo', application: 'RINSE_OFF', aqueous: true, blocks: [
    { role: 'Primary cleansing surfactant', fns: ['cleansing', 'surfactant'], classes: ['anionic-surfactant', 'nonionic-surfactant'] },
    { role: 'Mild co-surfactant', fns: ['surfactant', 'foam-boosting', 'cleansing'], classes: ['amphoteric-surfactant'] },
    { role: 'Conditioning polymer / quat', fns: ['hair-conditioning', 'antistatic'], classes: ['cationic'] },
    { role: 'Humectant', fns: ['humectant'] }, { role: 'Viscosity control', fns: ['viscosity-controlling'] }, { role: 'Chelating agent', fns: ['chelating'] },
    { role: 'Preservative', fns: ['preservative'] }, { role: 'pH adjuster', fns: ['buffering'] }] },
  'co-wash': { label: 'Co-wash / cleansing conditioner', application: 'RINSE_OFF', aqueous: true, blocks: [
    { role: 'Cationic conditioner', fns: ['hair-conditioning', 'antistatic'], classes: ['cationic'] }, { role: 'Mild surfactant', fns: ['surfactant', 'cleansing'], classes: ['nonionic-surfactant', 'amphoteric-surfactant'] },
    { role: 'Fatty alcohol / thickener', fns: ['emulsion-stabilising', 'viscosity-controlling', 'emollient'], classes: ['fatty-alcohol'] }, { role: 'Humectant', fns: ['humectant'] },
    { role: 'Preservative', fns: ['preservative'] }, { role: 'pH adjuster', fns: ['buffering'] }] },
  conditioner: { label: 'Rinse-out / deep conditioner', application: 'RINSE_OFF', aqueous: true, blocks: [
    { role: 'Cationic conditioner', fns: ['hair-conditioning', 'antistatic'], classes: ['cationic'] }, { role: 'Fatty alcohol (body, viscosity)', fns: ['emulsion-stabilising', 'viscosity-controlling', 'emollient'], classes: ['fatty-alcohol'] },
    { role: 'Emollient oil / butter', fns: ['emollient', 'hair-conditioning'], classes: ['botanical'] }, { role: 'Humectant', fns: ['humectant'] }, { role: 'Protein / amino acids (optional)', fns: ['hair-conditioning'], classes: ['protein'] },
    { role: 'Preservative', fns: ['preservative'] }, { role: 'pH adjuster', fns: ['buffering'] }] },
  'leave-in': { label: 'Leave-in conditioner', application: 'LEAVE_ON', aqueous: true, blocks: [
    { role: 'Cationic conditioner / detangler', fns: ['hair-conditioning', 'antistatic'], classes: ['cationic'] }, { role: 'Humectant', fns: ['humectant'] }, { role: 'Emollient', fns: ['emollient'] },
    { role: 'Emulsifier', fns: ['emulsifying'] }, { role: 'Film former (optional)', fns: ['film-forming'] }, { role: 'Preservative', fns: ['preservative'] }, { role: 'pH adjuster', fns: ['buffering'] }] },
  'curl-cream': { label: 'Curl cream / styling cream', application: 'LEAVE_ON', aqueous: true, blocks: [
    { role: 'Hold / film former', fns: ['film-forming', 'hair-fixing'] }, { role: 'Humectant', fns: ['humectant'] }, { role: 'Emollient oil / butter', fns: ['emollient'], classes: ['botanical'] },
    { role: 'Emulsifier', fns: ['emulsifying'] }, { role: 'Conditioning agent', fns: ['hair-conditioning'], classes: ['cationic'] }, { role: 'Thickener', fns: ['viscosity-controlling'] }, { role: 'Preservative', fns: ['preservative'] }] },
  gel: { label: 'Styling gel', application: 'LEAVE_ON', aqueous: true, blocks: [
    { role: 'Hold polymer', fns: ['hair-fixing', 'film-forming'] }, { role: 'Gelling agent', fns: ['viscosity-controlling', 'gel-forming'] }, { role: 'Humectant', fns: ['humectant'] },
    { role: 'Conditioning additive', fns: ['hair-conditioning'] }, { role: 'Preservative', fns: ['preservative'] }, { role: 'pH adjuster / neutraliser', fns: ['buffering'] }] },
  'edge-control': { label: 'Edge control', application: 'LEAVE_ON', aqueous: false, blocks: [
    { role: 'Hold / film former', fns: ['hair-fixing', 'film-forming'] }, { role: 'Wax / structurant', fns: ['viscosity-controlling', 'emollient'], classes: ['wax'] }, { role: 'Emollient', fns: ['emollient'] }, { role: 'Antioxidant', fns: ['antioxidant'] }] },
  'hair-oil': { label: 'Hair / scalp oil (anhydrous)', application: 'LEAVE_ON', aqueous: false, blocks: [
    { role: 'Carrier oils', fns: ['emollient', 'hair-conditioning'], classes: ['botanical'] }, { role: 'Lightweight emollient ester', fns: ['emollient'] }, { role: 'Antioxidant', fns: ['antioxidant'] }, { role: 'Fragrance / botanical aroma (optional)', fns: ['perfuming'] }] },
  'scalp-serum': { label: 'Scalp serum / treatment', application: 'LEAVE_ON', aqueous: true, blocks: [
    { role: 'Soothing / conditioning actives', fns: ['soothing', 'skin-conditioning'] }, { role: 'Humectant', fns: ['humectant'] }, { role: 'Solubiliser', fns: ['hydrotrope', 'surfactant'], classes: ['nonionic-surfactant'] },
    { role: 'Preservative', fns: ['preservative'] }, { role: 'pH adjuster', fns: ['buffering'] }] },
}

export const PREFERENCES: Record<string, { label: string; excludeClasses?: string[] }> = {
  'sulfate-free': { label: 'Sulfate-free', excludeClasses: ['sulfate-surfactant'] },
  'silicone-free': { label: 'Silicone-free', excludeClasses: ['silicone', 'water-dispersible-silicone'] },
  'protein-free': { label: 'Protein-free', excludeClasses: ['protein'] },
  'paraben-free': { label: 'Paraben-free', excludeClasses: ['paraben'] },
  'no-formaldehyde-releasers': { label: 'No formaldehyde releasers', excludeClasses: ['formaldehyde-releaser'] },
  'peg-free': { label: 'PEG/PPG-free', excludeClasses: ['peg-ppg'] },
  'no-short-chain-alcohol': { label: 'No short-chain alcohols', excludeClasses: ['short-chain-alcohol'] },
  'mineral-oil-free': { label: 'Mineral-oil/petrolatum-free', excludeClasses: ['petrolatum-mineral'] },
  'curly-girl': { label: 'Curly Girl method friendly (community guideline)', excludeClasses: ['cg-avoid'] },
  'fragrance-free': { label: 'Fragrance-free', excludeClasses: ['fragrance', 'eu-fragrance-allergen'] },
}

export const MARKET_GUIDE: Record<string, { label: string; points: string[]; url: string }> = {
  US: { label: 'United States', url: 'https://www.fda.gov/cosmetics/cosmetics-laws-regulations/modernization-cosmetics-regulation-act-2022-mocra', points: ['MoCRA: facility registration and product listing with FDA; a responsible person; adverse-event reporting; safety substantiation records.', 'Ingredient labelling in descending order of predominance (21 CFR 701.3).', 'Claims must not be drug claims (structure/function or treatment) unless the product is regulated as a drug.'] },
  EU: { label: 'European Union', url: 'https://single-market-economy.ec.europa.eu/sectors/cosmetics_en', points: ['An EU-based Responsible Person; a Cosmetic Product Safety Report by a qualified safety assessor (Annex I).', 'Notification in the CPNP before placing on the market; manufacture under GMP (EN ISO 22716).', 'Annex II–VI restrictions; labelled allergens; claims must meet the common criteria of Reg. (EU) 655/2013.'] },
  UK: { label: 'United Kingdom (GB)', url: 'https://www.gov.uk/guidance/making-cosmetic-products-available-to-consumers-in-great-britain', points: ['A UK-based Responsible Person and a product safety report.', 'Notification via the UK Submit Cosmetic Product Notification (SCPN) service.', 'UK restrictions can diverge from the EU over time; check entries individually.'] },
  CA: { label: 'Canada', url: 'https://www.canada.ca/en/health-canada/services/consumer-product-safety/cosmetics.html', points: ['Cosmetic Notification Form to Health Canada within 10 days of first sale.', 'Check ingredients against the Cosmetic Ingredient Hotlist.', 'Bilingual labelling requirements apply.'] },
}

export const MANUFACTURER_CHECKLIST = [
  'One-page product concept: category, target customer, performance goals, texture and sensory targets.',
  'Ingredient preferences: must-include, avoid lists, free-from positioning and certifications sought.',
  'Target markets and intended claims (so testing and documentation can be planned).',
  'Packaging type, fill size and decoration; packaging compatibility testing needs.',
  'Expected first-order quantity, reorder volumes and timeline.',
  'Budget per unit and target retail price; ask for MOQ, tooling, sample and testing fees in writing.',
  'Ownership of the formula and documentation (IP terms) and confidentiality agreement.',
  'Who provides: stability testing, preservative efficacy (challenge) testing, safety assessment, regulatory notification.',
]

export const ROADMAP = [
  'Concept & research — this brief; define must-haves and red lines.',
  'Manufacturer or formulator selection — share the brief under NDA; compare quotes and IP terms.',
  'Lab samples — iterate on texture and performance against your sensory targets.',
  'Stability, compatibility and preservative-efficacy testing in final packaging.',
  'Safety assessment and regulatory preparation for each market (notifications, labelling, responsible person).',
  'Claims substantiation testing for the claims you intend to make.',
  'Production run, quality release and launch; monitor consumer feedback and adverse events.',
]

async function namesToIds(text: string): Promise<{ ids: string[]; unknown: string[] }> {
  const idx = await cachedNameIndex()
  const parts = text.split(/[,;\n]/).map((x) => x.trim()).filter(Boolean)
  const ids: string[] = [], unknown: string[] = []
  for (const p of parts) { const m = matchName(idx, p); if (m.status !== 'UNMATCHED' && m.ingredientId) ids.push(m.ingredientId); else unknown.push(p) }
  return { ids, unknown }
}

export async function runBrief(principal: Principal, input: BriefInput): Promise<WorkflowResult> {
  void principal
  const cat = CATEGORIES[input.category]
  if (!cat) throw new Error('Choose a product category.')
  const excluded = [...new Set(input.preferences.flatMap((p) => PREFERENCES[p]?.excludeClasses ?? []))]
  const [inv, av] = await Promise.all([namesToIds(input.investigate), namesToIds(input.avoid)])
  const citations: Citation[] = Object.entries(MARKET_GUIDE).filter(([k]) => input.markets.includes(k)).map(([k, m]) => ({ id: `official:${k}`, kind: 'official' as const, label: `${m.label}: official cosmetics guidance`, href: m.url }))
  const findings: Finding[] = []
  const blockRows: string[][] = []
  // Market-use signal: how often an ingredient appears in products of this database.
  const uses = await prisma.productIngredient.groupBy({ by: ['ingredientId'], where: { ingredientId: { not: null }, productVersion: { validTo: null } }, _count: true })
  const useCount = new Map(uses.map((u) => [u.ingredientId!, u._count]))
  for (const b of cat.blocks) {
    const cands = await prisma.ingredient.findMany({
      where: { status: 'ACTIVE', cosingFunctions: { hasSome: b.fns }, ...(b.classes ? { derivedClasses: { hasSome: b.classes } } : {}), id: { notIn: av.ids }, ...(excluded.length ? { NOT: { derivedClasses: { hasSome: excluded } } } : {}), regulatory: { none: { status: 'PROHIBITED', supersededAt: null } } },
      select: { id: true, displayName: true, inciName: true, priorityTier: true, _count: { select: { evidenceLinks: true } } }, take: 400,
    })
    cands.sort((x, y) => (useCount.get(y.id) ?? 0) - (useCount.get(x.id) ?? 0) || Number(y.priorityTier !== null) - Number(x.priorityTier !== null) || y._count.evidenceLinks - x._count.evidenceLinks || x.displayName.localeCompare(y.displayName))
    const top = cands.slice(0, 5)
    for (const c of top) citations.push(citeIngredient(c))
    blockRows.push([b.role, top.map((c) => `${c.displayName}${useCount.get(c.id) ? ` (in ${useCount.get(c.id)} product${useCount.get(c.id) === 1 ? '' : 's'})` : ''}`).join(', ') || 'no candidates match your preferences', b.fns.join(', ').replace(/-/g, ' ')])
  }
  if (!cat.aqueous) findings.push({ title: 'Anhydrous format', detail: 'Water-free products may not need a water-phase preservative, but contamination risk (e.g. from wet hands or water ingress) should be assessed by your manufacturer or safety assessor.', certainty: 'NEEDS_TESTING', citations: [] })
  findings.push({ title: `${cat.label}: ${cat.blocks.length} functional building blocks`, detail: 'Typical architecture for this category. Candidates are examples to research, ordered by how often they appear in products in this database and by available data — not recommendations, and not a formula.', certainty: 'INFO', citations: [] })
  // Concerns → evidence
  const outcomeCodes = [...new Set([...input.concerns, ...mapOutcomes(`${input.performance} ${input.concerns.join(' ')}`)])]
  const terms = await prisma.ontologyTerm.findMany({ where: { code: { in: outcomeCodes } } })
  const evLinks = terms.length || inv.ids.length ? await prisma.evidenceLink.findMany({ where: { OR: [...(terms.length ? [{ ontologyTermId: { in: terms.map((t) => t.id) } }] : []), ...(inv.ids.length ? [{ ingredientId: { in: inv.ids } }] : [])] }, include: { evidence: true, ingredient: { select: { displayName: true } }, ontologyTerm: true }, take: 60 }) : []
  const evSeen = new Map<string, (typeof evLinks)[number]>()
  for (const l of evLinks) if (!evSeen.has(l.evidenceId)) evSeen.set(l.evidenceId, l)
  for (const l of evSeen.values()) citations.push(citeEvidence(l.evidence))
  if (evSeen.size) findings.push({ title: `${evSeen.size} evidence record(s) relate to your concerns or chosen ingredients`, detail: 'Records are listed below with their design and review status. Unreviewed classifications are AI-proposed and need qualified review before use in claims.', certainty: 'UNCERTAIN', citations: [...evSeen.keys()].map((k) => `ev:${k}`) })
  else findings.push({ title: 'No linked evidence for your concerns yet', detail: 'The evidence base for these outcomes is thin in this database; ask your formulator for supplier studies and plan your own testing.', certainty: 'UNSUPPORTED', citations: [] })
  // Claims
  const flags = screenClaimText(input.performance)
  if (flags.length) findings.push({ title: 'Some performance wording may be a drug or unsubstantiated claim', detail: `${flags.map((f) => `“${f.term}”`).join(', ')}: rephrase as cosmetic (appearance/feel) outcomes and plan substantiation. Use Workbench → Investigate a claim for a full assessment.`, certainty: 'REVIEW_REQUIRED', citations: citations.filter((c) => c.kind === 'official').map((c) => c.id) })
  if (inv.unknown.length || av.unknown.length) findings.push({ title: 'Some ingredient names were not recognised', detail: [...inv.unknown, ...av.unknown].join(', ') + '. Use INCI names where possible.', certainty: 'UNCERTAIN', citations: [] })
  if (inv.ids.length) { const xs = await prisma.ingredient.findMany({ where: { id: { in: inv.ids } }, select: { id: true, displayName: true, inciName: true } }); for (const x of xs) citations.push(citeIngredient(x)); findings.push({ title: `Ingredients you want to investigate: ${xs.map((x) => x.displayName).join(', ')}`, detail: 'Open each profile for official functions, regulatory records and evidence; use “Find substitutes” or “Compare” to explore alternatives.', certainty: 'INFO', citations: xs.map((x) => `ing:${x.id}`) }) }
  findings.push({ title: 'Cost', detail: `Target retail price: ${input.retailPrice || 'not given'}. The database holds no verified ingredient prices; cost per unit depends on supplier quotes, MOQs, packaging, fill and manufacturer fees. Ask manufacturers for itemised quotes rather than relying on estimates.`, certainty: 'UNSUPPORTED', citations: [] })

  return {
    headline: `Product development research brief: ${cat.label}`,
    summary: `A research brief for a ${cat.label.toLowerCase()} for ${input.targetCustomer || 'your target customer'}${input.markets.length ? `, sold in ${input.markets.join(', ')}` : ''}. It sets out the functional building blocks to discuss with a formulator, candidate ingredients to research within your preferences${input.preferences.length ? ` (${input.preferences.map((p) => PREFERENCES[p]?.label ?? p).join(', ')})` : ''}, what the evidence base says about your concerns, and the regulatory and manufacturing steps ahead. This is not a finished, safety-tested formulation.`,
    findings,
    tables: [
      { title: 'Concept', columns: ['Question', 'Your answer'], rows: [['Category', cat.label], ['Target customer', input.targetCustomer || '—'], ['Desired performance', input.performance || '—'], ['Hair / scalp concerns', input.concerns.join(', ').replace(/-/g, ' ') || '—'], ['Ingredient preferences', input.preferences.map((p) => PREFERENCES[p]?.label ?? p).join(', ') || '—'], ['Investigate', input.investigate || '—'], ['Avoid', input.avoid || '—'], ['Texture & sensory', input.texture || '—'], ['Markets', input.markets.join(', ') || '—'], ['Target retail price', input.retailPrice || '—'], ['Manufacturing constraints', input.constraints || '—']] },
      { title: 'Functional building blocks and candidates to research', caption: 'Filtered by your preferences and avoid list; ingredients with an EU prohibition record excluded. Ordered by appearances in products in this database, then data availability. Examples for research and discussion only.', columns: ['Building block', 'Candidates to research', 'Official functions used'], rows: blockRows },
      ...(evSeen.size ? [{ title: 'Evidence related to your concerns', columns: ['Record', 'Ingredient / outcome', 'Design', 'Review status'], rows: [...evSeen.values()].map((l) => [{ text: l.evidence.title, href: `/evidence/${l.evidence.id}` }, [l.ingredient?.displayName, l.ontologyTerm?.label].filter(Boolean).join(' / ') || '—', l.evidence.studyType.replace(/_/g, ' ').toLowerCase(), l.evidence.reviewStatus.toLowerCase()]) }] : []),
      ...(input.markets.length ? [{ title: 'Regulatory starting points', caption: 'Orientation only — verify with a regulatory specialist for each market.', columns: ['Market', 'What to plan for'], rows: input.markets.filter((m) => MARKET_GUIDE[m]).map((m) => [MARKET_GUIDE[m].label, MARKET_GUIDE[m].points.join(' ')]) }] : []),
      { title: 'Preparing for a manufacturer', columns: ['#', 'Bring to the first conversation'], rows: MANUFACTURER_CHECKLIST.map((x, k) => [String(k + 1), x]) },
      { title: 'Development roadmap', columns: ['Stage', 'What happens'], rows: ROADMAP.map((x, k) => [String(k + 1), x]) },
    ],
    openQuestions: ['Which two or three performance outcomes matter most, and how will you measure them?', 'What claims do you want on pack, and in which markets?', 'Do you need certifications (e.g. vegan, COSMOS) that constrain ingredient choice?', ...(input.constraints ? [`How do your manufacturing constraints (“${input.constraints}”) affect format, MOQ and timeline?`] : [])],
    nextSteps: ['Review the candidate ingredients with a cosmetic chemist or contract manufacturer.', 'Run “Investigate a claim” on your intended claim wording.', 'Request itemised quotes (formulation, samples, testing, MOQ) from at least two manufacturers.'],
    limitations: [...STANDARD_LIMITATIONS, 'Building blocks are typical patterns for the category, not a formula; a qualified formulator decides ingredients and levels.', 'No ingredient percentages or costs are provided, because none are verified in the database.'],
    methodology: `Category architecture (functional roles) × official CosIng functions and rule-based classes; preference filters exclude rule-derived classes; avoid list removes named ingredients; candidates ordered by appearances in products in the database, curated records, and evidence counts. Concerns mapped to the ii-hair-scalp ontology to retrieve evidence. Claims screened by the claims guard. Engine ${ENGINE_VERSION}.`,
    citations, verification: {},
  }
}
