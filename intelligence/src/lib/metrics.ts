import { readFileSync } from 'node:fs'
import path from 'node:path'
import { prisma } from './db'
import { isStale } from './regulatory'

export async function dashboardCounts(orgId: string) {
  const [ingredients, unresolvedQ, openIdentity, reviewedEvidenceIngredients, formulas, products, rawMaterials, evidence, patents, outcomes, mockOutcomes, candidates, openReviews, failedImports, regs] = await Promise.all([
    prisma.ingredient.count({ where: { status: 'ACTIVE' } }),
    prisma.quarantineItem.count({ where: { queue: { in: ['UNRESOLVED_IDENTITY', 'IDENTIFIER_MISMATCH', 'CONFLICTING_CAS'] }, status: 'OPEN' } }),
    prisma.identityResolutionCandidate.count({ where: { status: 'OPEN' } }),
    prisma.ingredient.count({ where: { evidenceLinks: { some: { evidence: { reviewStatus: 'APPROVED' } } } } }),
    prisma.formula.count({ where: { ownerOrgId: orgId } }),
    prisma.product.count(),
    prisma.rawMaterial.count({ where: { ownerOrgId: orgId } }),
    prisma.evidence.count(),
    prisma.patent.count(),
    prisma.outcomeObservation.count({ where: { isMock: false } }),
    prisma.outcomeObservation.count({ where: { isMock: true } }),
    prisma.researchCandidate.count({ where: { ownerOrgId: orgId } }),
    prisma.reviewTask.count({ where: { status: { in: ['SUBMITTED', 'ASSIGNED', 'UNDER_REVIEW', 'SECOND_REVIEW_REQUIRED', 'CHANGES_REQUESTED'] } } }),
    prisma.importJob.count({ where: { status: 'FAILED' } }),
    prisma.regulatoryRecord.findMany({ where: { supersededAt: null }, select: { lastCheckedAt: true, staleAfterDays: true } }),
  ])
  return {
    ingredients, unresolvedIdentities: unresolvedQ + openIdentity, reviewedEvidenceIngredients, formulas, products, rawMaterials, evidence, patents,
    outcomes, mockOutcomes, candidates, openReviews, failedImports, staleRegulatory: regs.filter((r) => isStale(r)).length, regulatoryRecords: regs.length,
  }
}

export type ReqStatus = 'MET' | 'NOT_MET' | 'PARTIAL' | 'NEEDS_QUALIFIED_REVIEW' | 'BLOCKED_NO_DOCUMENTS' | 'VERIFIED_BY_TEST' | 'NOT_VERIFIED' | 'TEST_FAILING'

interface TestFileResult { name: string; status: string }
/** Reads the latest Vitest JSON report (written by `npm test`). Returns null when no report exists. */
function latestTestReport(): { at: Date; files: Map<string, string> } | null {
  try {
    const raw = JSON.parse(readFileSync(path.join(/*turbopackIgnore: true*/ process.cwd(), 'test-results', 'vitest.json'), 'utf8')) as { startTime: number; testResults: TestFileResult[] }
    return { at: new Date(raw.startTime), files: new Map(raw.testResults.map((t) => [path.relative(process.cwd(), t.name), t.status])) }
  } catch {
    return null
  }
}

/** A requirement is test-verified only if every named test file ran in the latest report and passed. */
function testStatus(report: ReturnType<typeof latestTestReport>, files: string[]): { status: ReqStatus; note: string } {
  const list = files.join(', ')
  if (!report) return { status: 'NOT_VERIFIED', note: `${list} — no test report found; run npm test.` }
  const results = files.map((f) => report.files.get(f))
  const when = report.at.toISOString().slice(0, 16).replace('T', ' ')
  if (results.some((r) => r === undefined)) return { status: 'NOT_VERIFIED', note: `${list} — not all of these ran in the latest test run (${when} UTC).` }
  if (results.some((r) => r !== 'passed')) return { status: 'TEST_FAILING', note: `${list} — failing in the latest test run (${when} UTC).` }
  return { status: 'VERIFIED_BY_TEST', note: `${list} — passed ${when} UTC.` }
}
export interface Requirement { group: string; label: string; target?: string; actual?: string; status: ReqStatus; note?: string }

export async function phase1Requirements(): Promise<Requirement[]> {
  const report = latestTestReport()
  const t = (...files: string[]) => testStatus(report, files)
  const [
    ingredients, verifiable, verifiableWithId, priority, snIngredients, snLines, snMatched, evidenceIngr, reviewedEvidenceIngr, regIngr, patents, rawMats, rawDocs,
    formulas, sampleFormulas, products, productsParsed, edges, reviewedEdges, audit, importsUnchanged, importsDup, reviewTasks, approvedAny, searchEntries,
  ] = await Promise.all([
    prisma.ingredient.count({ where: { status: 'ACTIVE' } }),
    prisma.ingredient.count({ where: { status: 'ACTIVE', identityType: { in: ['DEFINED_SUBSTANCE', 'SALT', 'ESTER', 'ISOMER', 'DERIVATIVE'] } } }),
    prisma.ingredient.count({ where: { status: 'ACTIVE', identityType: { in: ['DEFINED_SUBSTANCE', 'SALT', 'ESTER', 'ISOMER', 'DERIVATIVE'] }, identifiers: { some: { verificationStatus: 'VERIFIED' } } } }),
    prisma.ingredient.count({ where: { status: 'ACTIVE', priorityTier: { in: [1, 2, 3, 4] } } }),
    prisma.ingredient.count({ where: { productLines: { some: { productVersion: { validTo: null, product: { isSupernatural: true } } } } } }),
    prisma.productIngredient.count({ where: { productVersion: { validTo: null, product: { isSupernatural: true } } } }),
    prisma.productIngredient.count({ where: { ingredientId: { not: null }, productVersion: { validTo: null, product: { isSupernatural: true } } } }),
    prisma.ingredient.count({ where: { evidenceLinks: { some: {} } } }),
    prisma.ingredient.count({ where: { evidenceLinks: { some: { evidence: { reviewStatus: 'APPROVED' } } } } }),
    prisma.ingredient.count({ where: { regulatory: { some: { supersededAt: null } } } }),
    prisma.patent.count(),
    prisma.rawMaterial.count(),
    prisma.document.count({ where: { rawMaterialId: { not: null } } }),
    prisma.formula.count(),
    prisma.formula.count({ where: { isSample: true } }),
    prisma.product.count(),
    prisma.product.count({ where: { versions: { some: { lines: { some: {} } } } } }),
    prisma.graphEdge.count({ where: { supersededAt: null } }),
    prisma.graphEdge.count({ where: { supersededAt: null, reviewStatus: 'APPROVED' } }),
    prisma.auditLog.count(),
    prisma.importJob.count({ where: { unchangedCount: { gt: 0 }, createdCount: 0 } }),
    prisma.importJob.aggregate({ _sum: { duplicateCount: true } }),
    prisma.reviewTask.count(),
    prisma.reviewTask.count({ where: { status: 'APPROVED' } }),
    prisma.searchEntry.count(),
  ])
  const pct = (a: number, b: number) => (b ? Math.round((a / b) * 100) : 0)
  const m = (ok: boolean, partial = false): ReqStatus => (ok ? 'MET' : partial ? 'PARTIAL' : 'NOT_MET')
  return [
    { group: 'Database', label: 'Canonical ingredients imported', target: '≥ 250', actual: String(ingredients), status: m(ingredients >= 250) },
    { group: 'Database', label: 'Ingredients with a verified identifier (where identifiers apply)', target: '≥ 90%', actual: `${verifiableWithId}/${verifiable} (${pct(verifiableWithId, verifiable)}%)`, status: m(pct(verifiableWithId, verifiable) >= 90, true), note: 'Applies to defined substances, salts, esters, isomers and derivatives (PubChem CID verified against PubChem). Botanicals, polymers and mixtures await the CosIng connector. CAS numbers are not yet assigned from an authoritative source.' },
    { group: 'Database', label: 'High-priority hair-care ingredients (tiers 1–4)', target: '≥ 100', actual: String(priority), status: m(priority >= 100) },
    { group: 'Database', label: 'Every ingredient in current Supernatural products', target: '100% of label lines linked', actual: `${snMatched}/${snLines} lines linked · ${snIngredients} ingredients`, status: m(snMatched === snLines, true), note: 'GROW and REST labels use common names (e.g. "Chamomile", "Almond"); these are linked with low confidence or left unlinked pending identity review. Full INCI lists from Supernatural are needed.' },
    { group: 'Database', label: 'Ingredients from Hair Passport-logged products', target: 'All identifiable', actual: 'No Hair Passport product logs exist yet', status: 'NOT_MET', note: 'Hair Passport currently stores product use only in each customer’s browser. Integration contract and mock endpoint are ready.' },
    { group: 'Database', label: 'Ingredients with evidence records', target: '≥ 50 reviewed', actual: `${evidenceIngr} linked · ${reviewedEvidenceIngr} reviewed`, status: reviewedEvidenceIngr >= 50 ? 'MET' : 'NEEDS_QUALIFIED_REVIEW', note: 'Evidence is real (PubMed IDs) but classified from titles only; a qualified scientific reviewer must review each record.' },
    { group: 'Database', label: 'Ingredients with regulatory records', target: '≥ 50', actual: String(regIngr), status: m(regIngr >= 50, regIngr > 0), note: 'All regulatory records are unverified drafts, shown as stale until a regulatory reviewer checks them against official text.' },
    { group: 'Database', label: 'Patent records', target: '≥ 25', actual: String(patents), status: m(patents >= 25) },
    { group: 'Database', label: 'Supplier / raw-material records', target: '≥ 25 when documents are available', actual: `${rawMats} sample records · ${rawDocs} documents`, status: rawDocs === 0 ? 'BLOCKED_NO_DOCUMENTS' : m(rawMats >= 25), note: 'No supplier documents have been provided. Sample raw materials demonstrate component linking and active-level math.' },
    { group: 'Database', label: 'Formula records', target: '≥ 10 (private or clearly labelled samples)', actual: `${formulas} (${sampleFormulas} samples)`, status: m(formulas >= 10) },
    { group: 'Database', label: 'Products with parsed ingredient lists', target: '≥ 10', actual: String(productsParsed), status: m(productsParsed >= 10) },
    { group: 'Database', label: 'Reviewed knowledge-graph relationships', target: '≥ 100 reviewed', actual: `${edges} relationships · ${reviewedEdges} reviewed`, status: reviewedEdges >= 100 ? 'MET' : 'NEEDS_QUALIFIED_REVIEW' },
    { group: 'Functional', label: 'Authentication, sessions, MFA, lockout', ...t('tests/integration/auth.test.ts') },
    { group: 'Functional', label: 'Role permissions and organization isolation', ...t('tests/unit/governance.test.ts', 'tests/integration/permissions.test.ts') },
    { group: 'Functional', label: 'Search across aliases and identifiers', actual: `${searchEntries} index entries`, ...t('tests/integration/search.test.ts') },
    { group: 'Functional', label: 'Imports repeatable without uncontrolled duplicates', actual: `${importsUnchanged} re-run job(s) fully unchanged · ${importsDup._sum.duplicateCount ?? 0} duplicates detected`, ...t('tests/integration/imports.test.ts') },
    { group: 'Functional', label: 'Formula percentages validated; versions preserved', ...t('tests/unit/formula.test.ts', 'tests/integration/formulas.test.ts') },
    { group: 'Functional', label: 'Product ingredient order preserved; list changes versioned', ...t('tests/integration/products.test.ts') },
    { group: 'Functional', label: 'Audit history records changes (append-only)', actual: `${audit} audit rows`, status: m(audit > 0) },
    { group: 'Functional', label: 'Review queues and approvals', actual: `${reviewTasks} tasks · ${approvedAny} approved`, ...t('tests/integration/review.test.ts') },
    { group: 'Functional', label: 'Hair Passport contract: consent, withdrawal, identifier rejection', ...t('tests/integration/hair-passport.test.ts') },
    { group: 'Functional', label: 'Versioned API: auth, scopes, data-rights withholding', ...t('tests/integration/api.test.ts') },
    { group: 'Quality', label: 'No fabricated dashboard statistics', status: 'MET', note: 'Every number on this page and the dashboard is a live database count.' },
    { group: 'Quality', label: 'No AI answer without citations', status: 'MET', note: 'The AI assistant is not built in Phase 1; no AI answers are produced.' },
    { group: 'Quality', label: 'No observational association described as causal', status: 'MET', note: 'Signal detection is Phase 3; the only outcome data is mock data, labelled as such.' },
  ]
}
