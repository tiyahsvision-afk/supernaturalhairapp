// Workflow A — find ingredient substitutes.
//
// Candidates are ranked by overlap of official EU CosIng functions, weighted by how specific each function is
// (inverse frequency), adjusted for rule-derived ionic class. Market-use (appearances in products in the database) and
// evidence availability are shown as context, not as proof. No candidate is presented as performing equivalently.
import { prisma } from '../db'
import { classify } from '../classify'
import { dimensionsFor, loadIntel, statusSummary, type Dimension } from '../dimensions'
import type { Principal } from '../permissions'
import { ALWAYS_TEST, ENGINE_VERSION, STANDARD_LIMITATIONS, citeIngredient, testsFor, type Cell, type Citation, type Finding, type WorkflowResult } from './types'

export interface SubstituteInput {
  ingredientId: string
  reason: string
  avoidClasses?: string[]
  keepFunctions?: string[]
  applicationType?: 'RINSE_OFF' | 'LEAVE_ON' | 'UNKNOWN'
}

const CHARGE = ['cationic', 'cationic-at-acidic-ph', 'anionic-surfactant', 'amphoteric-surfactant', 'nonionic-surfactant']
const chargeOf = (classes: string[]) => classes.find((c) => CHARGE.includes(c)) ?? null
const fnLabel = (f: string) => f.replace(/-/g, ' ')

export async function functionWeights() {
  const [rows, total] = await Promise.all([
    prisma.$queryRaw<{ fn: string; n: bigint }[]>`SELECT unnest("cosingFunctions") AS fn, count(*) AS n FROM "Ingredient" WHERE status = 'ACTIVE' GROUP BY 1`,
    prisma.ingredient.count({ where: { status: 'ACTIVE' } }),
  ])
  return new Map(rows.map((r) => [r.fn, Math.log((total + 1) / (Number(r.n) + 1))]))
}

export async function rankSubstitutes(input: SubstituteInput, limit = 12) {
  const target = await prisma.ingredient.findUniqueOrThrow({ where: { id: input.ingredientId } })
  const wanted = (input.keepFunctions?.length ? input.keepFunctions : target.cosingFunctions).filter(Boolean)
  const avoid = input.avoidClasses ?? []
  if (!wanted.length) return { target, wanted, ranked: [], excludedProhibited: 0, poolSize: 0 }
  const weights = await functionWeights()
  const targetClasses = target.derivedClasses.length ? target.derivedClasses : classify(target.inciName ?? target.canonicalName, target.cosingFunctions).map((c) => c.code)
  const targetCharge = chargeOf(targetClasses)
  const pool = await prisma.ingredient.findMany({
    where: { status: 'ACTIVE', id: { not: target.id }, cosingFunctions: { hasSome: wanted }, ...(avoid.length ? { NOT: { derivedClasses: { hasSome: avoid } } } : {}) },
    select: { id: true, displayName: true, inciName: true, cosingFunctions: true, derivedClasses: true, priorityTier: true },
    take: 6000,
  })
  const prohibited = new Set((await prisma.regulatoryRecord.findMany({ where: { ingredientId: { in: pool.map((p) => p.id) }, status: 'PROHIBITED', supersededAt: null }, select: { ingredientId: true } })).map((r) => r.ingredientId))
  const totalW = wanted.reduce((a, f) => a + (weights.get(f) ?? 1), 0)
  const scored = pool.filter((c) => !prohibited.has(c.id)).map((c) => {
    const shared = wanted.filter((f) => c.cosingFunctions.includes(f))
    const missing = wanted.filter((f) => !c.cosingFunctions.includes(f))
    let score = shared.reduce((a, f) => a + (weights.get(f) ?? 1), 0) / totalW
    const charge = chargeOf(c.derivedClasses)
    if (targetCharge && charge === targetCharge) score += 0.15
    if (targetCharge && charge && charge !== targetCharge) score -= 0.2
    return { ...c, shared, missing, charge, score: Math.round(score * 1000) / 1000 }
  })
  scored.sort((a, b) => b.score - a.score || Number(b.priorityTier !== null) - Number(a.priorityTier !== null))
  const head = scored.slice(0, 200)
  const [uses, evid, supp] = await Promise.all([
    prisma.productIngredient.groupBy({ by: ['ingredientId'], where: { ingredientId: { in: head.map((h) => h.id) }, productVersion: { validTo: null } }, _count: true }),
    prisma.evidenceLink.groupBy({ by: ['ingredientId'], where: { ingredientId: { in: head.map((h) => h.id) } }, _count: true }),
    prisma.rawMaterialComponent.groupBy({ by: ['ingredientId'], where: { ingredientId: { in: head.map((h) => h.id) } }, _count: true }),
  ])
  const cnt = (xs: { ingredientId: string | null; _count: number }[], id: string) => xs.find((x) => x.ingredientId === id)?._count ?? 0
  const ranked = head.map((h) => ({ ...h, productUses: cnt(uses, h.id), evidence: cnt(evid, h.id), supplierMaterials: cnt(supp, h.id) }))
    .sort((a, b) => b.score - a.score || Number(b.priorityTier !== null) - Number(a.priorityTier !== null) || b.productUses - a.productUses || b.evidence - a.evidence || a.displayName.localeCompare(b.displayName))
    .slice(0, limit)
  return { target, wanted, ranked, excludedProhibited: prohibited.size, poolSize: pool.length, targetCharge }
}

export async function runSubstitutes(principal: Principal, input: SubstituteInput): Promise<WorkflowResult> {
  const r = await rankSubstitutes(input)
  const { target, wanted, ranked } = r
  const citations: Citation[] = [citeIngredient(target)]
  const findings: Finding[] = []
  if (!wanted.length) {
    return {
      headline: `No official functions recorded for ${target.displayName}`,
      summary: 'Substitutes are ranked by shared official EU CosIng functions. This ingredient has none recorded, so no ranking was produced. Choose the functions you need to keep and run again.',
      findings: [{ title: 'Missing function data', detail: 'Add the functions to preserve (e.g. hair-conditioning, antistatic) in the research inputs.', certainty: 'UNSUPPORTED', citations: [`ing:${target.id}`] }],
      tables: [], openQuestions: ['Which functions must the replacement deliver?'], nextSteps: ['Select functions to preserve and re-run.'], limitations: STANDARD_LIMITATIONS, methodology: 'Function-overlap ranking (not run: no functions).', citations, verification: {},
    }
  }
  for (const c of ranked) citations.push(citeIngredient(c))
  const top = ranked.slice(0, 3)
  const intel = (await loadIntel(principal, [target.id, ...top.map((t) => t.id)])).map(dimensionsFor)
  const tDims = intel[0]?.dims ?? []
  const comparisonKeys = ['inci', 'cas', 'function', 'charge', 'mw', 'polarity', 'solubility', 'ph', 'usage', 'regulatory', 'safety', 'evidence', 'suppliers', 'cost']
  const pick = (dims: Dimension[], k: string): Cell => { const d = dims.find((x) => x.key === k); return { text: d?.value ?? (d?.status === 'NOT_APPLICABLE' ? 'n/a' : '—'), status: d?.status } }

  findings.push({
    title: `${ranked.length} candidate(s) share official functions with ${target.displayName}`,
    detail: `Ranked on overlap with: ${wanted.map(fnLabel).join(', ')}. Specific functions weigh more than broad ones.${input.avoidClasses?.length ? ` Excluded classes: ${input.avoidClasses.join(', ')}.` : ''}${r.excludedProhibited ? ` ${r.excludedProhibited} candidate(s) with an EU prohibition record were excluded.` : ''}`,
    certainty: 'SUPPORTED', citations: [`ing:${target.id}`, ...top.map((t) => `ing:${t.id}`)],
  })
  const chargeShift = ranked.filter((c) => r.targetCharge && c.charge && c.charge !== r.targetCharge)
  if (r.targetCharge) findings.push({ title: `Target is ${r.targetCharge.replace(/-/g, ' ')} (rule-derived)`, detail: chargeShift.length ? `${chargeShift.length} candidate(s) differ in ionic class (${chargeShift.map((c) => c.displayName).slice(0, 4).join(', ')}). A change of ionic class can change compatibility with the rest of the system.` : 'Top candidates share the same ionic class, which reduces — but does not remove — compatibility risk.', certainty: 'NEEDS_TESTING', citations: chargeShift.slice(0, 4).map((c) => `ing:${c.id}`) })
  const noEvidence = top.filter((t) => t.evidence === 0)
  findings.push({ title: 'Performance equivalence is not established', detail: `Sharing official functions does not show equal sensory or technical performance.${noEvidence.length ? ` No linked evidence for: ${noEvidence.map((t) => t.displayName).join(', ')}.` : ''} Bench testing in the target formulation is required.`, certainty: 'NEEDS_TESTING', citations: top.map((t) => `ing:${t.id}`) })
  const restricted = await prisma.regulatoryRecord.findMany({ where: { ingredientId: { in: ranked.map((c) => c.id) }, supersededAt: null, status: { in: ['RESTRICTED', 'CONDITIONALLY_PERMITTED'] } }, include: { ingredient: { select: { id: true, displayName: true } } } })
  if (restricted.length) {
    for (const x of restricted) citations.push({ id: `reg:${x.id}`, kind: 'regulatory', label: `${x.ingredient.displayName}: ${x.jurisdiction} ${x.status.toLowerCase().replace(/_/g, ' ')} — ${x.regulationRef ?? ''}`, href: `/ingredients/${x.ingredient.id}?tab=regulatory` })
    findings.push({ title: `${new Set(restricted.map((x) => x.ingredientId)).size} candidate(s) have regulatory restrictions`, detail: 'Conditions of use or maximum concentrations apply in at least one market. Verify against the current official text for each target market.', certainty: 'REVIEW_REQUIRED', citations: restricted.map((x) => `reg:${x.id}`) })
  }

  const tables = [
    {
      title: 'Candidate overview', caption: 'Score = weighted share of the target’s official functions, adjusted for ionic class. Context columns are counts of records in this database, not quality judgements.',
      columns: ['Candidate', 'Score', 'Shared functions', 'Not covered', 'Class (rule)', 'Products using it', 'Evidence records', 'Supplier materials'],
      rows: ranked.map((c) => [{ text: c.displayName, href: `/ingredients/${c.id}` }, c.score.toFixed(2), c.shared.map(fnLabel).join(', '), c.missing.map(fnLabel).join(', ') || '—', c.charge?.replace(/-/g, ' ') ?? '—', String(c.productUses), String(c.evidence), String(c.supplierMaterials)]),
    },
    { title: `Technical comparison: ${target.displayName} vs top candidates`, caption: 'Each cell carries its data status. “—” means no sourced value exists.', columns: ['Dimension', target.displayName, ...top.map((t) => t.displayName)], rows: comparisonKeys.map((k) => [tDims.find((d) => d.key === k)?.label ?? k, pick(tDims, k), ...intel.slice(1).map((i) => pick(i.dims, k))]) },
  ]
  const tests = [...testsFor(wanted), ...ALWAYS_TEST]
  const verification = statusSummary(intel.flatMap((i) => i.dims))
  return {
    headline: `Substitution research for ${target.displayName}`,
    summary: `${ranked.length} candidates share the official functions that matter for this replacement (${wanted.map(fnLabel).join(', ')}). The strongest function matches are ${top.map((t) => t.displayName).join(', ') || 'none'}. None has evidence of equivalent performance in your formulation; treat these as a shortlist for bench testing.${input.reason ? ` Stated reason: “${input.reason}”.` : ''}`,
    findings, tables,
    openQuestions: [
      'Which sensory and technical attributes must be preserved (e.g. slip, wet combing, residue, viscosity build)?',
      'What is the base system (anionic, cationic, nonionic) and target pH of the formulation?',
      'Which markets and claims must the replacement support?',
      ...(input.reason ? [`Does each shortlisted candidate address the stated reason: “${input.reason}”?`] : []),
    ],
    nextSteps: [
      `Shortlist 2–3 candidates and request technical and safety data sheets from suppliers (${top.map((t) => t.displayName).join(', ') || 'shortlist pending'}).`,
      `Plan bench tests: ${tests.join('; ')}.`,
      'Check regulatory status and conditions of use in every target market for the shortlisted candidates.',
      'Record test outcomes back in this project so the evidence base grows.',
    ],
    limitations: [...STANDARD_LIMITATIONS, 'Candidates are limited to ingredients with official CosIng functions; curated-only records may be missed.', 'Product-use counts reflect only products in this database.'],
    methodology: `Pool: active ingredients sharing at least one of the target's official CosIng functions${input.avoidClasses?.length ? ', excluding rule-derived classes the user wants to avoid' : ''}, excluding ingredients with an EU prohibition record. Score: Σ inverse-frequency weight of shared functions / Σ weight of target functions, +0.15 for the same rule-derived ionic class, −0.20 for a different one. Ties are broken by curated hair-care records first, then appearances in products and evidence in this database. Pool size ${r.poolSize}. Engine ${ENGINE_VERSION}.`,
    citations, verification,
  }
}
