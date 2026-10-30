// Technical dimensions of an ingredient, each with an explicit data status.
//
// Shared by the ingredient profile, the comparison engine, the workbench and reports. A dimension is never filled with
// an invented value: if no source supports it, its status is MISSING (or NOT_APPLICABLE for complex materials).
import type { IdentityType } from '@prisma/client'
import { prisma } from './db'
import { classify, type DerivedClass } from './classify'
import { visibilityWhere, type Principal } from './permissions'
import { isStale } from './regulatory'

export type DataStatus = 'VERIFIED' | 'REPORTED' | 'SUPPLIER' | 'DERIVED' | 'HYPOTHESIS' | 'MISSING' | 'NOT_APPLICABLE'

export const STATUS_META: Record<DataStatus, { label: string; help: string; tone: 'good' | 'info' | 'warn' | 'neutral' | 'bad' }> = {
  VERIFIED: { label: 'Verified', help: 'Approved by a qualified reviewer, or identifier verified against an authoritative source.', tone: 'good' },
  REPORTED: { label: 'Source-reported', help: 'Stated by a cited external source (e.g. EU CosIng, PubChem computed properties, regulation); not yet reviewed.', tone: 'info' },
  SUPPLIER: { label: 'Supplier-reported', help: 'Declared by a supplier (TDS, SDS, specification); requires verification.', tone: 'info' },
  DERIVED: { label: 'Rule-derived', help: 'Computed by a transparent naming/function rule; a screening aid, not a measurement.', tone: 'neutral' },
  HYPOTHESIS: { label: 'Hypothesis', help: 'AI-proposed or inferred and not yet reviewed. Not a basis for decisions on its own.', tone: 'warn' },
  MISSING: { label: 'Missing', help: 'No source in the database supports a value.', tone: 'bad' },
  NOT_APPLICABLE: { label: 'Not applicable', help: 'Not meaningful for this kind of material (e.g. molecular weight of a botanical extract).', tone: 'neutral' },
}

export interface Dimension {
  key: string
  label: string
  group: 'Identity' | 'Physicochemical' | 'Formulation' | 'Safety & regulatory' | 'Supply & cost' | 'Evidence & IP'
  value: string | null
  status: DataStatus
  source?: string | null
  note?: string
  help?: string
}

const COMPLEX: IdentityType[] = ['POLYMER', 'COPOLYMER', 'PROTEIN', 'HYDROLYSATE', 'BOTANICAL_EXTRACT', 'BOTANICAL_FRACTION', 'ESSENTIAL_OIL', 'FIXED_OIL', 'WAX', 'FERMENT', 'LYSATE', 'FILTRATE', 'PROPRIETARY_BLEND', 'FRAGRANCE_MIXTURE', 'DELIVERY_SYSTEM', 'RAW_MATERIAL_BLEND', 'UVCB', 'UNKNOWN_COMPOSITION']

export async function loadIntel(principal: Principal, ids: string[]) {
  const [ings, sources, edges] = await Promise.all([
    prisma.ingredient.findMany({
      where: { id: { in: ids } },
      include: {
        identifiers: { where: { supersededAt: null } },
        facts: { where: { supersededAt: null } },
        concentrations: { where: { supersededAt: null } },
        regulatory: { where: { supersededAt: null }, orderBy: { jurisdiction: 'asc' } },
        safetyReviews: { where: { supersededAt: null } },
        evidenceLinks: { include: { evidence: { select: { id: true, title: true, studyType: true, evidenceLevel: true, reviewStatus: true, pmid: true, sourceUrl: true, qualityReviewerCategory: true } } } },
        patentLinks: { select: { patentId: true } },
        rawComponents: { where: { rawMaterial: visibilityWhere(principal, 'rawmaterial:read') }, include: { rawMaterial: { include: { supplier: true, _count: { select: { documents: true } } } } } },
        functions: { include: { function: true } },
      },
    }),
    prisma.source.findMany({ select: { id: true, name: true, key: true } }),
    prisma.graphEdge.findMany({ where: { edgeType: { in: ['COMPATIBLE_WITH', 'INCOMPATIBLE_WITH'] }, supersededAt: null, OR: [{ fromType: 'Ingredient', fromId: { in: ids } }, { toType: 'Ingredient', toId: { in: ids } }] } }),
  ])
  const srcName = new Map(sources.map((s) => [s.id, s.name]))
  return ids.map((id) => ings.find((i) => i.id === id)).filter(Boolean).map((ing) => ({ ing: ing!, srcName, edges: edges.filter((e) => e.fromId === ing!.id || e.toId === ing!.id) }))
}

type Intel = Awaited<ReturnType<typeof loadIntel>>[number]

function factDim(intel: Intel, key: string, label: string, group: Dimension['group'], types: string[], opts: { naForComplex?: boolean; help?: string; fmt?: (v: string) => string } = {}): Dimension {
  const { ing, srcName } = intel
  if (opts.naForComplex && COMPLEX.includes(ing.identityType)) return { key, label, group, value: null, status: 'NOT_APPLICABLE', note: 'Not meaningful for a complex or multi-component material.', help: opts.help }
  const facts = ing.facts.filter((f) => types.includes(f.propertyType))
  if (!facts.length) return { key, label, group, value: null, status: 'MISSING', help: opts.help }
  const show = (f: (typeof facts)[number]) => {
    const v = f.normalizedValue != null ? `${Number(f.normalizedValue)}${f.normalizedUnit && f.normalizedUnit !== 'dimensionless' && f.normalizedUnit !== 'count' ? ` ${f.normalizedUnit}` : ''}` : (f.valueText ?? f.originalValue ?? '')
    return opts.fmt ? opts.fmt(v) : v
  }
  const approved = facts.find((f) => f.reviewStatus === 'APPROVED')
  const pick = approved ?? facts[0]
  const distinct = new Set(facts.map(show))
  const status: DataStatus = approved ? 'VERIFIED' : pick.entryMode === 'AI_EXTRACTED' ? 'HYPOTHESIS' : 'REPORTED'
  return { key, label, group, value: show(pick), status, source: pick.sourceId ? srcName.get(pick.sourceId) : null, note: [pick.testConditions, distinct.size > 1 ? `Sources disagree (${[...distinct].join(' vs ')})` : null].filter(Boolean).join(' · ') || undefined, help: opts.help }
}

export function dimensionsFor(intel: Intel): { dims: Dimension[]; derived: DerivedClass[] } {
  const { ing, srcName, edges } = intel
  const derived = classify(ing.inciName ?? ing.canonicalName, ing.cosingFunctions)
  const dc = new Set(derived.map((d) => d.code))
  const cosing = ing.cosingRef || ing.cosingFunctions.length ? 'EU CosIng' : null
  const ids = (type: string) => ing.identifiers.filter((i) => i.type === type)
  const idDim = (key: string, label: string, type: string): Dimension => {
    const xs = ids(type)
    if (!xs.length) return { key, label, group: 'Identity', value: null, status: 'MISSING', note: COMPLEX.includes(ing.identityType) ? 'Complex materials often have no single registry number.' : undefined }
    const verified = xs.some((x) => x.verificationStatus === 'VERIFIED')
    return { key, label, group: 'Identity', value: xs.map((x) => x.value).join(', '), status: verified ? 'VERIFIED' : 'REPORTED', source: [...new Set(xs.map((x) => (x.sourceId ? srcName.get(x.sourceId) : null)).filter(Boolean))].join(', '), note: xs.length > 1 ? 'Several numbers are listed for this INCI (grades or historical registrations).' : undefined }
  }
  const namingRule = ing.identityNote?.includes('naming rules')
  const charge = derived.find((d) => d.group === 'charge')
  const pcFact = ing.facts.find((f) => f.propertyType === 'CHARGE')
  const conc = (type: string, label: string): string | null => {
    const xs = ing.concentrations.filter((c) => c.recordType === type)
    if (!xs.length) return null
    return xs.map((c) => `${c.minValue ?? '?'}–${c.maxValue ?? '?'} ${c.unit ?? '%'}${c.applicationType && c.applicationType !== 'UNKNOWN' ? ` (${c.applicationType.toLowerCase().replace(/_/g, '-')})` : ''}`).join('; ') + ` — ${label}`
  }
  const usage = [conc('SUPPLIER_RECOMMENDATION', 'supplier recommendation'), conc('LITERATURE_TESTED', 'tested in cited study'), conc('OBSERVED_COMMERCIAL_USE', 'observed commercial use'), conc('INTERNAL_RANGE', 'internal range')].filter(Boolean)
  const usageReviewed = ing.concentrations.some((c) => c.reviewStatus === 'APPROVED' && c.recordType !== 'REGULATORY_MAXIMUM')
  const incompat = edges.filter((e) => e.edgeType === 'INCOMPATIBLE_WITH')
  const compatNotes: string[] = []
  if (dc.has('cationic') && !dc.has('anionic-surfactant')) compatNotes.push('Cationic: possible complexation with anionic surfactants/polymers — test in the target base.')
  if (dc.has('anionic-surfactant')) compatNotes.push('Anionic: possible complexation with cationic conditioners — test in the target base.')
  const supplierMats = ing.rawComponents.map((c) => c.rawMaterial)
  const priced = supplierMats.filter((m) => m.priceRange)
  const evid = ing.evidenceLinks
  const evidReviewed = evid.filter((l) => l.evidence.reviewStatus === 'APPROVED')
  const humanStudies = evid.filter((l) => ['CONTROLLED_HUMAN', 'HUMAN_OBSERVATIONAL'].includes(l.evidence.studyType))
  const staleRegs = ing.regulatory.filter((r) => isStale(r))

  const dims: Dimension[] = [
    { key: 'inci', label: 'INCI name', group: 'Identity', value: ing.inciName ?? null, status: ing.inciName ? (cosing ? 'REPORTED' : ing.reviewStatus === 'APPROVED' ? 'VERIFIED' : 'HYPOTHESIS') : 'MISSING', source: cosing ?? 'Curated seed (pending review)' },
    idDim('cas', 'CAS number', 'CAS'),
    idDim('ec', 'EC number', 'EC'),
    { key: 'identity', label: 'Chemical identity', group: 'Identity', value: `${ing.identityType.replace(/_/g, ' ').toLowerCase()}${ing.chemicalName ? ` · ${ing.chemicalName}` : ''}${ing.cosingDescription && ing.cosingDescription !== ing.inciName ? ` · ${ing.cosingDescription}` : ''}`, status: ing.reviewStatus === 'APPROVED' ? 'VERIFIED' : namingRule ? 'DERIVED' : 'HYPOTHESIS', source: namingRule ? 'Naming rule' : 'Curated seed', note: ing.cosingDescription ? 'Description text from EU CosIng.' : undefined },
    { key: 'function', label: 'Function (official)', group: 'Formulation', value: ing.cosingFunctions.length ? ing.cosingFunctions.join(', ') : null, status: ing.cosingFunctions.length ? 'REPORTED' : 'MISSING', source: cosing, help: 'Functions declared in the EU CosIng inventory. They describe permitted roles, not proven performance.' },
    factDim(intel, 'mw', 'Molecular weight', 'Physicochemical', ['MOLECULAR_WEIGHT'], { naForComplex: true }),
    factDim(intel, 'solubility', 'Solubility', 'Physicochemical', ['SOLUBILITY', 'DISPERSIBILITY']),
    factDim(intel, 'polarity', 'Polarity (computed XLogP)', 'Physicochemical', ['PARTITION_COEFFICIENT'], { naForComplex: true, help: 'Octanol–water partition coefficient. Computed values (PubChem XLogP3) are estimates, not measurements.' }),
    charge
      ? { key: 'charge', label: 'Charge / ionic character', group: 'Physicochemical', value: charge.label, status: 'DERIVED', source: 'Naming rule', note: charge.basis }
      : pcFact ? factDim(intel, 'charge', 'Charge / ionic character', 'Physicochemical', ['CHARGE'], { fmt: (v) => `formal charge ${v}`, help: 'Formal charge of the representative structure (PubChem).' })
        : { key: 'charge', label: 'Charge / ionic character', group: 'Physicochemical', value: null, status: 'MISSING' },
    factDim(intel, 'ph', 'pH behaviour / working range', 'Formulation', ['PH_RANGE', 'PKA']),
    factDim(intel, 'thermal', 'Thermal stability / processing temperature', 'Formulation', ['PROCESSING_TEMPERATURE', 'STABILITY_RANGE', 'MELTING_POINT']),
    factDim(intel, 'oxidation', 'Oxidation sensitivity', 'Formulation', ['OXIDATION_SENSITIVITY', 'LIGHT_SENSITIVITY']),
    factDim(intel, 'hlb', 'HLB', 'Formulation', ['HLB']),
    {
      key: 'compat', label: 'Formulation compatibility', group: 'Formulation',
      value: incompat.length || compatNotes.length ? [...incompat.map((e) => `Recorded incompatibility (${e.reviewStatus === 'APPROVED' ? 'reviewed' : 'unreviewed'})`), ...compatNotes].join(' ') : null,
      status: incompat.some((e) => e.reviewStatus === 'APPROVED') ? 'VERIFIED' : incompat.length ? 'REPORTED' : compatNotes.length ? 'DERIVED' : 'MISSING',
      note: compatNotes.length ? 'Charge-based considerations are general chemistry rules, not test results.' : undefined,
    },
    { key: 'usage', label: 'Typical published usage', group: 'Formulation', value: usage.length ? usage.join(' · ') : null, status: usage.length ? (usageReviewed ? 'VERIFIED' : 'REPORTED') : 'MISSING', help: 'Supplier recommendations, levels tested in cited studies and observed commercial use are different things and are labelled separately.' },
    {
      key: 'safety', label: 'Safety considerations', group: 'Safety & regulatory',
      value: [...ing.safetyReviews.map((s) => `${s.reviewBody}: ${s.conclusion}`), ...(dc.has('eu-fragrance-allergen') ? ['EU labelled fragrance allergen (labelling threshold 0.001% leave-on / 0.01% rinse-off)'] : []), ...(dc.has('formaldehyde-releaser') ? ['Formaldehyde-releasing preservative'] : [])].join(' · ') || null,
      status: ing.safetyReviews.some((s) => s.reviewStatus === 'APPROVED') ? 'VERIFIED' : ing.safetyReviews.length ? 'REPORTED' : dc.has('eu-fragrance-allergen') || dc.has('formaldehyde-releaser') ? 'DERIVED' : 'MISSING',
      note: 'Safety must be assessed for the finished product by a qualified safety assessor.',
    },
    {
      key: 'regulatory', label: 'Regulatory restrictions', group: 'Safety & regulatory',
      value: ing.regulatory.length ? ing.regulatory.map((r) => `${r.jurisdiction}: ${r.status.toLowerCase().replace(/_/g, ' ')}${r.maxConcentration ? ` (max ${r.maxConcentration}${r.maxConcentrationUnit ?? ''})` : ''}${r.regulationRef ? ` — ${r.regulationRef}` : ''}`).join(' · ') : null,
      status: ing.regulatory.some((r) => r.reviewStatus === 'APPROVED' && !isStale(r)) ? 'VERIFIED' : ing.regulatory.length ? 'REPORTED' : 'MISSING',
      note: ing.regulatory.length ? `${staleRegs.length} of ${ing.regulatory.length} record(s) need verification against current official text.` : 'No record does not mean unrestricted; check each market.',
    },
    { key: 'suppliers', label: 'Supplier availability', group: 'Supply & cost', value: supplierMats.length ? `${supplierMats.length} raw material(s): ${supplierMats.map((m) => `${m.tradeName}${m.supplier ? ` (${m.supplier.name})` : ''}${m.isSample ? ' [sample]' : ''}`).join(', ')}` : null, status: supplierMats.length ? 'SUPPLIER' : 'MISSING', note: supplierMats.length ? `${supplierMats.reduce((a, m) => a + m._count.documents, 0)} supplier document(s) on file.` : 'No supplier materials recorded in your workspace.' },
    { key: 'interactions', label: 'Documented interactions', group: 'Formulation', value: edges.length ? `${edges.length} recorded compatibility relationship(s)` : null, status: edges.some((e) => e.reviewStatus === 'APPROVED') ? 'VERIFIED' : edges.length ? 'REPORTED' : 'MISSING' },
    { key: 'evidence', label: 'Published scientific evidence', group: 'Evidence & IP', value: evid.length ? `${evid.length} linked record(s); ${humanStudies.length} human; ${evidReviewed.length} reviewed; highest level ${Math.max(0, ...evid.map((l) => l.evidence.evidenceLevel ?? 0)) || 'unrated'}` : null, status: evidReviewed.length ? 'VERIFIED' : evid.length ? 'HYPOTHESIS' : 'MISSING', note: evid.length && !evidReviewed.length ? 'Study types and levels are AI-proposed from titles until reviewed.' : undefined },
    { key: 'patents', label: 'Patent relationships', group: 'Evidence & IP', value: ing.patentLinks.length ? `${ing.patentLinks.length} linked patent publication(s)` : null, status: ing.patentLinks.length ? 'REPORTED' : 'MISSING', note: 'Research aid — not a legal opinion.' },
    { key: 'cost', label: 'Cost considerations', group: 'Supply & cost', value: priced.length ? priced.map((m) => `${m.tradeName}: ${m.priceRange}`).join(' · ') : null, status: priced.length ? 'SUPPLIER' : 'MISSING', note: priced.length ? 'Supplier-quoted; confirm current pricing, grade and MOQ.' : 'No verified price. Request quotes; do not assume a substitution changes cost.' },
  ]
  return { dims, derived }
}

/** Counts by status, for "data verification status" summaries in reports and comparisons. */
export function statusSummary(dims: Dimension[]) {
  const out: Record<DataStatus, number> = { VERIFIED: 0, REPORTED: 0, SUPPLIER: 0, DERIVED: 0, HYPOTHESIS: 0, MISSING: 0, NOT_APPLICABLE: 0 }
  for (const d of dims) out[d.status]++
  return out
}
