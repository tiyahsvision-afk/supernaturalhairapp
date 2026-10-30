// Workflow B — research a formulation.
//
// Rule-based screening of a formulation (an existing formula version the user may see, or pasted lines). It identifies
// each line, checks totals, and raises compatibility, preservation, regulatory and labelling questions. Every concern
// is phrased as a question for laboratory or specialist follow-up; nothing here is a test result.
import { prisma } from '../db'
import { validateFormula } from '../formula-math'
import { parseIngredientList } from '../inci-parser'
import { normalizeName } from '../normalize'
import type { Principal } from '../permissions'
import { isStale } from '../regulatory'
import { cachedNameIndex, fuzzyCandidates, matchName } from '../services/matching'
import { getFormulaForPrincipal } from '../services/formulas'
import { ALWAYS_TEST, ENGINE_VERSION, STANDARD_LIMITATIONS, citeIngredient, testsFor, type Citation, type Finding, type WorkflowResult } from './types'

export interface FormulationLine { name: string; percent?: number | null; qs?: boolean }
export interface FormulationInput {
  formulaId?: string
  lines?: FormulationLine[]
  productType?: string
  applicationType?: 'RINSE_OFF' | 'LEAVE_ON' | 'UNKNOWN'
  targetPh?: number | null
  markets?: string[]
}

/**
 * Parses pasted formula text: one line per ingredient ("Glycerin 3", "Aqua q.s.", "Behentrimonium Chloride, 2 %"),
 * or a single comma-separated ingredient list with no percentages.
 */
export function parseFormulaText(text: string): FormulationLine[] {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean)
  if (lines.length === 1 && lines[0].includes(',') && !/\d\s*%?\s*$/.test(lines[0])) return parseIngredientList(lines[0]).items.map((i) => ({ name: i.displayedName }))
  return lines.map((l) => {
    const m = /^(.*?)[\s,;:\t]+(q\.?\s?s\.?|qs|ad\s*100|to\s*100)\s*%?$/i.exec(l)
    if (m) return { name: m[1].trim(), qs: true }
    const p = /^(.*?)[\s,;:\t]+(\d+(?:[.,]\d+)?)\s*%?$/.exec(l)
    if (p) return { name: p[1].trim(), percent: Number(p[2].replace(',', '.')) }
    return { name: l }
  })
}

const PH_DEPENDENT = /(BENZOATE|SORBATE|BENZOIC ACID|SORBIC ACID|DEHYDROACETIC|DEHYDROACETATE|LEVULINIC|LEVULINATE|ANISIC ACID|P-ANISATE|SALICYLIC ACID)$/
const WATER = new Set(['aqua', 'water', 'aqua/water', 'water/aqua', 'aqua (water)', 'water (aqua)', 'eau'])

export async function runFormulation(principal: Principal, input: FormulationInput): Promise<WorkflowResult> {
  let lines: FormulationLine[] = input.lines ?? []
  let formulaLabel = 'Pasted formulation'
  const citations: Citation[] = []
  if (input.formulaId) {
    const f = await getFormulaForPrincipal(principal, input.formulaId)
    if (!f) throw new Error('Formula not found or not visible to your organization.')
    const v = f.versions[0]
    formulaLabel = `${f.code} v${v.versionNumber} — ${f.name}${f.isSample ? ' (sample)' : ''}`
    lines = v.lines.map((l) => ({ name: l.ingredient?.inciName ?? l.displayName, percent: l.isQs ? null : l.percent === null ? null : Number(l.percent), qs: l.isQs }))
    citations.push({ id: `formula:${f.id}`, kind: 'formula', label: formulaLabel, href: `/formulas/${f.id}` })
  }
  if (!lines.length) throw new Error('Provide formula lines or choose a formula.')
  const index = await cachedNameIndex()
  const resolved = [] as { line: FormulationLine; ingredientId: string | null; status: string; confidence: number }[]
  for (const line of lines.slice(0, 120)) {
    let m = matchName(index, line.name)
    if (m.status === 'UNMATCHED') {
      const fz = await fuzzyCandidates(line.name, 1)
      if (fz.length && fz[0].sim >= 0.6) m = { ingredientId: fz[0].entityId, confidence: Number((fz[0].sim * 0.7).toFixed(2)), method: 'FUZZY', status: 'AMBIGUOUS', candidates: [fz[0].entityId] }
    }
    resolved.push({ line, ingredientId: m.ingredientId, status: m.status, confidence: m.confidence })
  }
  const ids = [...new Set(resolved.map((r) => r.ingredientId).filter(Boolean) as string[])]
  const [ings, edges, evid] = await Promise.all([
    prisma.ingredient.findMany({ where: { id: { in: ids } }, include: { regulatory: { where: { supersededAt: null } } } }),
    prisma.graphEdge.findMany({ where: { edgeType: 'INCOMPATIBLE_WITH', supersededAt: null, fromType: 'Ingredient', toType: 'Ingredient', fromId: { in: ids }, toId: { in: ids } } }),
    prisma.evidenceLink.groupBy({ by: ['ingredientId'], where: { ingredientId: { in: ids } }, _count: true }),
  ])
  const byId = new Map(ings.map((i) => [i.id, i]))
  for (const i of ings) citations.push(citeIngredient(i))
  const rows = resolved.map((r) => ({ ...r, ing: r.ingredientId ? byId.get(r.ingredientId) ?? null : null }))
  const has = (cls: string) => rows.filter((r) => r.ing?.derivedClasses.includes(cls))
  const withFn = (fn: string) => rows.filter((r) => r.ing?.cosingFunctions.includes(fn))
  const findings: Finding[] = []
  const questions: string[] = []
  const cite = (rs: typeof rows) => rs.map((r) => `ing:${r.ing!.id}`)

  // Identity
  const unresolved = rows.filter((r) => r.status !== 'MATCHED')
  if (unresolved.length) {
    findings.push({ title: `${unresolved.length} line(s) not confidently identified`, detail: `${unresolved.map((r) => `“${r.line.name}”${r.ing ? ` (closest: ${r.ing.displayName})` : ''}`).join('; ')}. Use INCI names so identity, function and regulatory data can be attached.`, certainty: 'UNCERTAIN', citations: cite(unresolved.filter((r) => r.ing)) })
    questions.push('What are the exact INCI names (and suppliers) of the unidentified lines?')
  }
  // Totals
  const withPct = lines.filter((l) => l.percent != null || l.qs)
  let totalsText = 'No percentages supplied; totals not checked.'
  if (withPct.length) {
    const v = validateFormula(lines.map((l) => ({ displayName: l.name, percent: l.percent ?? null, isQs: Boolean(l.qs) })))
    totalsText = `Sum of stated percentages ${v.total.toFixed(3)}%${v.qsAmount !== null ? `; q.s. line resolves to ${v.qsAmount.toFixed(3)}%` : ''}.`
    findings.push({ title: v.valid ? 'Percentages add up' : 'Percentages do not add up', detail: [totalsText, ...v.errors, ...v.warnings].join(' '), certainty: v.valid ? 'ESTABLISHED' : 'UNSUPPORTED', citations: [] })
  }
  // Ionic compatibility
  const cationic = has('cationic'), anionic = has('anionic-surfactant')
  if (cationic.length && anionic.length) {
    findings.push({ title: 'Cationic and anionic ingredients together', detail: `Cationic (${cationic.map((r) => r.ing!.displayName).join(', ')}) with anionic surfactant(s) (${anionic.map((r) => r.ing!.displayName).join(', ')}). Possible complexation affecting clarity, viscosity, foam or deposition. Some systems rely on this deliberately (coacervate deposition); others fail. Class assignments are rule-derived.`, certainty: 'NEEDS_TESTING', citations: cite([...cationic, ...anionic]) })
    questions.push('Does the cationic/anionic combination stay clear and stable, and does it deliver the intended deposition?')
  }
  // Preservation
  const aqueous = rows.some((r) => WATER.has(normalizeName(r.line.name)) || r.ing?.inciName?.toUpperCase() === 'AQUA')
  const preservatives = withFn('preservative')
  if (aqueous && !preservatives.length) {
    findings.push({ title: 'No ingredient with an official preservative function identified', detail: 'Water-containing products generally need a preservation system. Some ingredients have antimicrobial activity without a preservative listing; only a challenge test on the final product shows adequacy.', certainty: 'NEEDS_TESTING', citations: [] })
    questions.push('What preservation system is intended, and has a challenge test (e.g. ISO 11930) been planned?')
  }
  const phDep = preservatives.filter((r) => PH_DEPENDENT.test((r.ing!.inciName ?? r.ing!.canonicalName).toUpperCase()))
  if (phDep.length) {
    const ph = input.targetPh
    findings.push({ title: 'pH-dependent preservative(s)', detail: `${phDep.map((r) => r.ing!.displayName).join(', ')}: organic-acid preservatives are generally effective only in their acid form at low pH. ${ph != null ? `Target pH ${ph}${ph > 5.5 ? ' is above the range where these are usually relied on.' : '.'}` : 'No target pH was given.'}`, certainty: 'NEEDS_TESTING', citations: cite(phDep) })
    questions.push('What is the final pH, and does preservative efficacy hold at that pH over shelf life?')
  }
  // Recorded incompatibilities
  for (const e of edges) {
    const a = byId.get(e.fromId), b = byId.get(e.toId)
    if (a && b) findings.push({ title: `Recorded incompatibility: ${a.displayName} / ${b.displayName}`, detail: `${e.notes ?? 'Recorded in the knowledge graph.'} ${e.reviewStatus === 'APPROVED' ? '(reviewed)' : '(unreviewed)'}`, certainty: e.reviewStatus === 'APPROVED' ? 'ESTABLISHED' : 'UNCERTAIN', citations: [`ing:${a.id}`, `ing:${b.id}`] })
  }
  // Regulatory
  const markets = input.markets?.length ? input.markets : ['EU', 'US', 'UK', 'CA']
  const regRows: string[][] = []
  for (const r of rows) {
    for (const g of r.ing?.regulatory ?? []) {
      if (!markets.includes(g.jurisdiction) || g.status === 'ALLOWED' || g.status === 'NOT_LISTED') continue
      const pct = r.line.percent ?? null
      const max = g.maxConcentration !== null && g.maxConcentrationUnit?.includes('%') ? Number(g.maxConcentration) : null
      const exceeds = pct !== null && max !== null ? pct > max : null
      citations.push({ id: `reg:${g.id}`, kind: 'regulatory', label: `${r.ing!.displayName} — ${g.jurisdiction} ${g.status.toLowerCase().replace(/_/g, ' ')}${g.regulationRef ? ` (${g.regulationRef})` : ''}`, href: `/ingredients/${r.ing!.id}?tab=regulatory` })
      regRows.push([r.ing!.displayName, g.jurisdiction, g.status.replace(/_/g, ' ').toLowerCase(), max !== null ? `${max}%` : 'see annex', pct !== null ? `${pct}%` : '—', exceeds === null ? 'not checked' : exceeds ? 'EXCEEDS stated max' : 'within stated max', isStale(g) ? 'needs verification' : 'checked'])
      findings.push({ title: `${r.ing!.displayName}: ${g.jurisdiction} ${g.status.replace(/_/g, ' ').toLowerCase()}`, detail: `${g.regulationRef ?? ''}${g.notes ? ` — ${g.notes}` : ''}${exceeds ? ` Stated level ${pct}% exceeds the recorded maximum of ${max}%.` : ''}`, certainty: 'REVIEW_REQUIRED', citations: [`reg:${g.id}`] })
    }
  }
  // Labelling
  const allergens = has('eu-fragrance-allergen')
  if (allergens.length) findings.push({ title: 'EU labelled fragrance allergens present', detail: `${allergens.map((r) => r.ing!.displayName).join(', ')} must be named on EU/UK labels above 0.001% (leave-on) or 0.01% (rinse-off).`, certainty: 'REVIEW_REQUIRED', citations: cite(allergens) })
  if (has('fragrance').length) { findings.push({ title: 'Fragrance (parfum) declared', detail: 'Allergen content inside the fragrance must come from the fragrance supplier’s allergen statement to determine EU/UK labelling.', certainty: 'REVIEW_REQUIRED', citations: cite(has('fragrance')) }); questions.push('Has the fragrance supplier provided an allergen declaration and IFRA certificate?') }
  if (has('formaldehyde-releaser').length) findings.push({ title: 'Formaldehyde-releasing preservative', detail: `${has('formaldehyde-releaser').map((r) => r.ing!.displayName).join(', ')}: additional EU labelling rules for formaldehyde release may apply; consumer acceptance considerations.`, certainty: 'REVIEW_REQUIRED', citations: cite(has('formaldehyde-releaser')) })

  // Functional coverage
  const roles: [string, string[]][] = [['Cleansing / surfactant', ['cleansing', 'surfactant']], ['Hair conditioning', ['hair-conditioning']], ['Antistatic', ['antistatic']], ['Humectant', ['humectant']], ['Emollient', ['emollient']], ['Viscosity control', ['viscosity-controlling']], ['Emulsifying', ['emulsifying']], ['Preservative', ['preservative']], ['pH adjustment / buffering', ['buffering']], ['Chelating', ['chelating']], ['Film forming', ['film-forming']], ['Fragrance / perfuming', ['perfuming', 'masking']]]
  const coverage = roles.map(([label, fns]) => { const xs = rows.filter((r) => r.ing && fns.some((f) => r.ing!.cosingFunctions.includes(f))); return [label, xs.length ? xs.map((r) => r.ing!.displayName).join(', ') : 'none identified'] })
  const allFns = [...new Set(rows.flatMap((r) => r.ing?.cosingFunctions ?? []))]
  const evCount = (id: string | null) => (id ? evid.find((e) => e.ingredientId === id)?._count ?? 0 : 0)

  const concerns = findings.filter((f) => ['NEEDS_TESTING', 'REVIEW_REQUIRED', 'UNSUPPORTED'].includes(f.certainty)).length
  return {
    headline: `Formulation research: ${formulaLabel}`,
    summary: `${rows.length} line(s), ${rows.length - unresolved.length} identified. ${concerns} point(s) need laboratory testing or specialist review. ${totalsText} This is a screening of the declared composition, not a stability, safety or efficacy assessment.`,
    findings,
    tables: [
      { title: 'Lines', columns: ['#', 'Declared', 'Identified as', '%', 'Official functions', 'Class (rule)', 'Evidence records'], rows: rows.map((r, i) => [String(i + 1), r.line.name, r.ing ? { text: `${r.ing.displayName}${r.status !== 'MATCHED' ? ` (${Math.round(r.confidence * 100)}% match)` : ''}`, href: `/ingredients/${r.ing.id}`, status: r.status === 'MATCHED' ? undefined : 'HYPOTHESIS' } : { text: 'not identified', status: 'MISSING' }, r.line.qs ? 'q.s.' : r.line.percent != null ? String(r.line.percent) : '—', r.ing?.cosingFunctions.join(', ').replace(/-/g, ' ') || '—', r.ing?.derivedClasses.filter((c) => !c.startsWith('cg-')).join(', ').replace(/-/g, ' ') || '—', String(evCount(r.ingredientId))]) },
      { title: 'Functional building blocks', caption: 'Based on official CosIng functions of identified lines. A listed function is a permitted role, not proof of performance at the used level.', columns: ['Role', 'Provided by'], rows: coverage },
      ...(regRows.length ? [{ title: `Regulatory flags (${markets.join(', ')})`, caption: 'Only restricted, prohibited or conditional records are listed. No record does not mean unrestricted.', columns: ['Ingredient', 'Market', 'Status', 'Recorded max', 'Stated level', 'Check', 'Record'], rows: regRows }] : []),
    ],
    openQuestions: [...new Set([...questions, 'What are the target pH, viscosity and appearance specifications?', 'Which claims will be made, and in which markets?'])],
    nextSteps: [`Resolve identity of any unidentified lines.`, `Plan laboratory work: ${[...testsFor(allFns), ...ALWAYS_TEST].join('; ')}.`, 'Have a qualified safety assessor and a regulatory specialist review the final formula for each market.'],
    limitations: [...STANDARD_LIMITATIONS, 'Rules screen the declared composition only; they cannot see processing, raw-material grades, impurities or packaging.', 'Regulatory records may be incomplete or outdated; see each record’s verification date.'],
    methodology: `Lines matched to canonical ingredients by exact INCI/name/alias (fuzzy matches shown with confidence). Screens: percentage totals; rule-derived ionic classes; preservative presence in water-containing formulas; pH-dependent preservatives; recorded incompatibilities; regulatory records for ${markets.join(', ')}; EU labelled allergens; fragrance and formaldehyde-releaser labelling. Engine ${ENGINE_VERSION}.`,
    citations, verification: { REPORTED: ings.filter((i) => i.cosingFunctions.length).length, DERIVED: ings.filter((i) => i.derivedClasses.length).length, MISSING: unresolved.length },
  }
}
