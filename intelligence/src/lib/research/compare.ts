// Ingredient comparison engine: technical dimensions side by side, each value with its data status.
import { dimensionsFor, loadIntel, statusSummary } from '../dimensions'
import type { Principal } from '../permissions'
import { ENGINE_VERSION, STANDARD_LIMITATIONS, citeIngredient, type Cell, type Finding, type WorkflowResult } from './types'

export interface CompareInput { ingredientIds: string[] }

export async function runCompare(principal: Principal, input: CompareInput): Promise<WorkflowResult> {
  const ids = [...new Set(input.ingredientIds)].slice(0, 6)
  if (ids.length < 2) throw new Error('Choose at least two ingredients to compare.')
  const intel = await loadIntel(principal, ids)
  const rows = intel.map((i) => ({ ing: i.ing, ...dimensionsFor(i) }))
  const keys = rows[0].dims.map((d) => d.key)
  const findings: Finding[] = []
  const charges = rows.map((r) => r.derived.find((d) => d.group === 'charge')?.label ?? null)
  if (new Set(charges.filter(Boolean)).size > 1) findings.push({ title: 'Different ionic classes', detail: rows.map((r, k) => `${r.ing.displayName}: ${charges[k] ?? 'not classified'}`).join('; ') + '. Swapping between ionic classes can change compatibility with the rest of a formula.', certainty: 'NEEDS_TESTING', citations: rows.map((r) => `ing:${r.ing.id}`) })
  const regs = rows.map((r) => r.dims.find((d) => d.key === 'regulatory'))
  const restricted = rows.filter((r, k) => regs[k]?.value)
  if (restricted.length) findings.push({ title: 'Regulatory records differ', detail: restricted.map((r) => `${r.ing.displayName}: ${r.dims.find((d) => d.key === 'regulatory')!.value}`).join(' | '), certainty: 'REVIEW_REQUIRED', citations: restricted.map((r) => `ing:${r.ing.id}`) })
  const shared = rows.map((r) => new Set(r.ing.cosingFunctions))
  const common = [...shared[0]].filter((f) => shared.every((s) => s.has(f)))
  findings.push({ title: common.length ? `Shared official functions: ${common.join(', ').replace(/-/g, ' ')}` : 'No official function is shared by all compared ingredients', detail: 'Official functions describe permitted roles, not relative performance.', certainty: 'INFO', citations: rows.map((r) => `ing:${r.ing.id}`) })
  for (const r of rows) {
    const s = statusSummary(r.dims)
    if (s.MISSING > r.dims.length / 2) findings.push({ title: `${r.ing.displayName}: most technical data is missing`, detail: `${s.MISSING} of ${r.dims.length} dimensions have no sourced value. Supplier documents or literature are needed before relying on this comparison.`, certainty: 'UNSUPPORTED', citations: [`ing:${r.ing.id}`] })
  }
  const all = rows.flatMap((r) => r.dims)
  return {
    headline: `Ingredient comparison: ${rows.map((r) => r.ing.displayName).join(' · ')}`,
    summary: `${rows.length} ingredients compared across ${keys.length} dimensions. Every cell shows whether its value is verified, source-reported, supplier-reported, rule-derived, a hypothesis, or missing.`,
    findings,
    tables: [
      { title: 'Side-by-side', columns: ['Dimension', ...rows.map((r) => r.ing.displayName)], rows: keys.map((k) => [rows[0].dims.find((d) => d.key === k)!.label, ...rows.map((r): Cell => { const d = r.dims.find((x) => x.key === k)!; return { text: d.value ?? (d.status === 'NOT_APPLICABLE' ? 'n/a' : '—'), status: d.status } })]) },
      { title: 'Rule-based classes', columns: ['Ingredient', 'Classes'], rows: rows.map((r) => [{ text: r.ing.displayName, href: `/ingredients/${r.ing.id}` }, r.derived.map((d) => d.label).join(', ') || '—']) },
    ],
    openQuestions: ['Which dimensions matter most for this decision (e.g. charge, solubility, regulatory status in target markets)?', 'Which missing values should be requested from suppliers?'],
    nextSteps: ['Request TDS/SDS for missing technical values.', 'Shortlist and bench-test in the target formulation.'],
    limitations: STANDARD_LIMITATIONS,
    methodology: `Dimensions computed from records in the database with explicit status per value (see dimensions.ts). Engine ${ENGINE_VERSION}.`,
    citations: rows.map((r) => citeIngredient(r.ing)), verification: statusSummary(all),
  }
}
