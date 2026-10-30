// Workflow D — compare suppliers for an ingredient or raw material.
//
// Uses only raw materials, suppliers, documents and specifications recorded in the caller's workspace (plus shared
// records). Nothing is inferred about stock, price, certification or relationships; gaps are reported as gaps.
import { prisma } from '../db'
import { visibilityWhere, type Principal } from '../permissions'
import { ENGINE_VERSION, STANDARD_LIMITATIONS, citeIngredient, type Cell, type Citation, type Finding, type WorkflowResult } from './types'

export interface SupplierInput { ingredientId?: string; rawMaterialId?: string; requirements?: string }

const DOC_TYPES = ['TDS', 'SDS', 'COA', 'SPECIFICATION', 'REGULATORY'] as const

export async function runSuppliers(principal: Principal, input: SupplierInput): Promise<WorkflowResult> {
  const vis = visibilityWhere(principal, 'rawmaterial:read')
  let ingredientIds: string[] = []
  let subject = ''
  const citations: Citation[] = []
  if (input.rawMaterialId) {
    const rm = await prisma.rawMaterial.findFirst({ where: { AND: [{ id: input.rawMaterialId }, vis] }, include: { components: { include: { ingredient: true } } } })
    if (!rm) throw new Error('Raw material not found or not visible to your organization.')
    ingredientIds = rm.components.map((c) => c.ingredientId).filter(Boolean) as string[]
    subject = rm.tradeName
    for (const c of rm.components) if (c.ingredient) citations.push(citeIngredient(c.ingredient))
  } else if (input.ingredientId) {
    const ing = await prisma.ingredient.findUniqueOrThrow({ where: { id: input.ingredientId } })
    ingredientIds = [ing.id]
    subject = ing.displayName
    citations.push(citeIngredient(ing))
  } else throw new Error('Choose an ingredient or a raw material.')

  const now = new Date()
  const mats = await prisma.rawMaterial.findMany({
    where: { AND: [vis, { components: { some: { ingredientId: { in: ingredientIds } } } }] },
    include: { supplier: true, components: { include: { ingredient: { select: { id: true, displayName: true } } } }, documents: { where: { AND: [visibilityWhere(principal, 'document:read')] } }, specs: true },
  })
  for (const m of mats) citations.push({ id: `rm:${m.id}`, kind: 'raw_material', label: `${m.tradeName}${m.supplier ? ` — ${m.supplier.name}` : ''}${m.isSample ? ' (sample record)' : ''}`, href: `/raw-materials/${m.id}` })
  const docStatus = (m: (typeof mats)[number], t: string): Cell => {
    const d = m.documents.filter((x) => x.docType === t)
    if (!d.length) return { text: 'not on file', status: 'MISSING' }
    const expired = d.every((x) => x.expiresAt && x.expiresAt < now)
    return { text: `${d.length} on file${expired ? ' (expired)' : ''}${d.some((x) => x.reviewStatus === 'APPROVED') ? ', reviewed' : ''}`, status: d.some((x) => x.reviewStatus === 'APPROVED') ? 'VERIFIED' : 'SUPPLIER' }
  }
  const val = (v: string | null | undefined | number | boolean, status: 'SUPPLIER' = 'SUPPLIER'): Cell => (v === null || v === undefined || v === '' ? { text: 'unknown', status: 'MISSING' } : { text: String(v), status })

  const findings: Finding[] = []
  if (!mats.length) {
    findings.push({ title: 'No supplier materials on file', detail: `No raw materials containing ${subject} are recorded in your workspace. The platform does not invent supplier relationships: add materials from quotes or supplier documents (Raw materials → New) to compare them.`, certainty: 'UNSUPPORTED', citations: citations.map((c) => c.id) })
  } else {
    const missingDocs = mats.filter((m) => !m.documents.some((d) => d.docType === 'SDS') || !m.documents.some((d) => d.docType === 'TDS'))
    if (missingDocs.length) findings.push({ title: `${missingDocs.length} material(s) lack a TDS or SDS`, detail: missingDocs.map((m) => m.tradeName).join(', '), certainty: 'UNSUPPORTED', citations: missingDocs.map((m) => `rm:${m.id}`) })
    const unconfirmed = mats.filter((m) => m.activePercent && !m.activePercentConfirmed)
    if (unconfirmed.length) findings.push({ title: 'Active content not confirmed', detail: `${unconfirmed.map((m) => m.tradeName).join(', ')}: active % is declared but not confirmed against a document, so in-formula active levels cannot be computed reliably.`, certainty: 'UNCERTAIN', citations: unconfirmed.map((m) => `rm:${m.id}`) })
    const samples = mats.filter((m) => m.isSample)
    if (samples.length) findings.push({ title: `${samples.length} record(s) are illustrative samples`, detail: 'Sample records demonstrate the comparison; they are not real supplier offers.', certainty: 'INFO', citations: samples.map((m) => `rm:${m.id}`) })
    const unverifiedSpecs = mats.flatMap((m) => m.specs).filter((s) => !s.verifiedAt)
    if (unverifiedSpecs.length) findings.push({ title: `${unverifiedSpecs.length} specification value(s) not yet verified`, detail: 'Extracted or entered values must be checked against the source document before use.', certainty: 'UNCERTAIN', citations: [] })
  }
  const params = [...new Set(mats.flatMap((m) => m.specs.map((s) => s.parameter)))].slice(0, 15)
  return {
    headline: `Supplier comparison: ${subject}`,
    summary: mats.length ? `${mats.length} raw material(s) containing ${subject} are on file from ${new Set(mats.map((m) => m.supplier?.name ?? 'unknown supplier')).size} supplier(s). Documentation completeness and stated commercial terms are compared below; all commercial information is as stated by suppliers and must be re-confirmed.` : `No supplier materials containing ${subject} are recorded in your workspace yet.`,
    findings,
    tables: mats.length ? [
      { title: 'Materials and commercial terms', caption: 'As stated by suppliers. “unknown” means not recorded.', columns: ['Material', 'Supplier', 'Grade', 'Declared composition', 'Active %', 'Origin', 'MOQ', 'Lead time', 'Price (stated)', 'Certifications'], rows: mats.map((m) => [{ text: `${m.tradeName}${m.isSample ? ' (sample)' : ''}`, href: `/raw-materials/${m.id}` }, val(m.supplier?.name), val(m.grade), val(m.declaredComposition), m.activePercent ? { text: `${m.activePercent}%${m.activePercentConfirmed ? ' (confirmed)' : ' (declared)'}`, status: m.activePercentConfirmed ? 'VERIFIED' : 'SUPPLIER' } : val(null), val(m.countryOfOrigin), val(m.moq), val(m.leadTime), val(m.priceRange), val([...m.certifications, ...(m.supplier?.certifications ?? [])].join(', '))]) },
      { title: 'Documentation status', columns: ['Material', ...DOC_TYPES], rows: mats.map((m) => [m.tradeName, ...DOC_TYPES.map((t) => docStatus(m, t))]) },
      ...(params.length ? [{ title: 'Specifications', caption: 'From supplier documents; ✓ = verified by a person against the document.', columns: ['Parameter', ...mats.map((m) => m.tradeName)], rows: params.map((p) => [p, ...mats.map((m): Cell => { const s = m.specs.find((x) => x.parameter === p); return s ? { text: `${s.value}${s.unit ? ` ${s.unit}` : ''}${s.method ? ` (${s.method})` : ''}`, status: s.verifiedAt ? 'VERIFIED' : s.entryMode === 'AI_EXTRACTED' ? 'HYPOTHESIS' : 'SUPPLIER' } : { text: '—', status: 'MISSING' } })]) }] : []),
    ] : [],
    openQuestions: ['Which grade, purity and certifications (e.g. COSMOS, RSPO, halal) does your product require?', 'What volumes and timelines must the supplier meet?', ...(input.requirements ? [`Do candidates meet: “${input.requirements}”?`] : [])],
    nextSteps: ['Request current TDS, SDS and a recent COA for each candidate material.', 'Request quotes with MOQ, lead time and price breaks; record them on the raw material.', 'Verify specification values against documents and mark them verified.', 'Qualify a second source for critical materials.'],
    limitations: [...STANDARD_LIMITATIONS, 'Only materials recorded in your workspace (and shared records) are compared; the platform has no live supplier catalogue connection.', 'Stated prices, MOQs, lead times and certifications change and must be re-confirmed with the supplier.'],
    methodology: `Raw materials whose declared components include the subject ingredient, visible to your organization; documents and specifications attached to each. Engine ${ENGINE_VERSION}.`,
    citations, verification: { SUPPLIER: mats.length, MISSING: mats.length ? 0 : 1 },
  }
}
