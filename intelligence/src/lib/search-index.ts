import type { Prisma, Visibility } from '@prisma/client'
import { prisma } from './db'
import { normalizeName, normalizeIdentifier } from './normalize'

type Tx = Prisma.TransactionClient | typeof prisma

interface Entry { term: string; termKind: string; weight?: number; normalizedOverride?: string }

async function replaceEntries(tx: Tx, entityType: string, entityId: string, label: string, detail: string | null, entries: Entry[], owner?: { ownerOrgId: string | null; visibility: Visibility | null }) {
  await tx.searchEntry.deleteMany({ where: { entityType, entityId } })
  const seen = new Set<string>()
  const data = []
  for (const e of entries) {
    if (!e.term) continue
    const normalized = e.normalizedOverride ?? normalizeName(e.term)
    if (!normalized) continue
    const k = `${normalized}|${e.termKind}`
    if (seen.has(k)) continue
    seen.add(k)
    data.push({ entityType, entityId, term: e.term, normalized, termKind: e.termKind, label, detail, weight: e.weight ?? 0, ownerOrgId: owner?.ownerOrgId ?? null, visibility: owner?.visibility ?? null })
  }
  if (data.length) await tx.searchEntry.createMany({ data })
}

export async function reindexIngredient(id: string, tx: Tx = prisma) {
  const ing = await tx.ingredient.findUnique({
    where: { id },
    include: { names: true, aliases: true, identifiers: { where: { supersededAt: null, verificationStatus: { not: 'REJECTED' } } }, functions: { include: { function: true } } },
  })
  if (!ing) return
  if (ing.status === 'MERGED') {
    await tx.searchEntry.deleteMany({ where: { entityType: 'ingredient', entityId: id } })
    return
  }
  const entries: Entry[] = [
    { term: ing.canonicalName, termKind: 'CANONICAL', weight: 10 },
    { term: ing.displayName, termKind: 'CANONICAL', weight: 9 },
  ]
  if (ing.inciName) entries.push({ term: ing.inciName, termKind: 'INCI', weight: 10 })
  if (ing.commonName) entries.push({ term: ing.commonName, termKind: 'NAME', weight: 7 })
  if (ing.chemicalName) entries.push({ term: ing.chemicalName, termKind: 'NAME', weight: 6 })
  for (const n of ing.names) entries.push({ term: n.name, termKind: n.nameType === 'INCI' ? 'INCI' : 'NAME', weight: 6 })
  for (const a of ing.aliases) entries.push({ term: a.alias, termKind: a.aliasType === 'MISSPELLING' ? 'MISSPELLING' : 'ALIAS', weight: a.aliasType === 'MISSPELLING' ? 2 : 5 })
  for (const i of ing.identifiers) {
    if (i.type === 'SMILES' || i.type === 'INCHI') continue
    entries.push({ term: i.value, termKind: 'IDENTIFIER', weight: 8, normalizedOverride: normalizeIdentifier(i.type, i.value).toLowerCase() })
  }
  for (const f of ing.functions) entries.push({ term: f.function.label, termKind: 'FUNCTION', weight: 1 })
  const detail = [ing.inciName && ing.inciName !== ing.displayName ? `INCI: ${ing.inciName}` : null, ing.identityType.replace(/_/g, ' ').toLowerCase()].filter(Boolean).join(' · ')
  await replaceEntries(tx, 'ingredient', id, ing.displayName, detail, entries)
}

export async function reindexProduct(id: string, tx: Tx = prisma) {
  const p = await tx.product.findUnique({ where: { id } })
  if (!p) return
  await replaceEntries(tx, 'product', id, `${p.brand} — ${p.name}`, p.category, [
    { term: p.name, termKind: 'TITLE', weight: 8 },
    { term: `${p.brand} ${p.name}`, termKind: 'TITLE', weight: 8 },
    { term: p.brand, termKind: 'BRAND', weight: 4 },
    ...(p.barcode ? [{ term: p.barcode, termKind: 'IDENTIFIER', weight: 8 }] : []),
  ])
}

export async function reindexPatent(id: string, tx: Tx = prisma) {
  const p = await tx.patent.findUnique({ where: { id } })
  if (!p) return
  await replaceEntries(tx, 'patent', id, `${p.publicationNumber} — ${p.title}`, p.jurisdiction, [
    { term: p.publicationNumber, termKind: 'IDENTIFIER', weight: 9 },
    { term: p.title, termKind: 'TITLE', weight: 6 },
    ...p.topics.map((t) => ({ term: t, termKind: 'TEXT', weight: 1 })),
    ...p.assignees.map((t) => ({ term: t, termKind: 'NAME', weight: 3 })),
  ])
}

export async function reindexEvidence(id: string, tx: Tx = prisma) {
  const e = await tx.evidence.findUnique({ where: { id } })
  if (!e) return
  await replaceEntries(tx, 'evidence', id, e.title, `${e.studyType.replace(/_/g, ' ').toLowerCase()}${e.pmid ? ` · PMID ${e.pmid}` : ''}`, [
    { term: e.title, termKind: 'TITLE', weight: 6 },
    ...(e.pmid ? [{ term: e.pmid, termKind: 'IDENTIFIER', weight: 9 }, { term: `pmid ${e.pmid}`, termKind: 'IDENTIFIER', weight: 9 }] : []),
    ...(e.doi ? [{ term: e.doi, termKind: 'IDENTIFIER', weight: 9, normalizedOverride: e.doi.toLowerCase() }] : []),
  ])
}

export async function reindexSupplier(id: string, tx: Tx = prisma) {
  const s = await tx.supplier.findUnique({ where: { id } })
  if (!s) return
  await replaceEntries(tx, 'supplier', id, s.name, s.type, [{ term: s.name, termKind: 'TITLE', weight: 8 }])
}

export async function reindexRawMaterial(id: string, tx: Tx = prisma) {
  const r = await tx.rawMaterial.findUnique({ where: { id }, include: { supplier: true } })
  if (!r) return
  await replaceEntries(tx, 'raw_material', id, r.tradeName, r.supplier?.name ?? null, [
    { term: r.tradeName, termKind: 'TITLE', weight: 8 },
  ], { ownerOrgId: r.ownerOrgId, visibility: r.visibility })
}

export async function reindexFormula(id: string, tx: Tx = prisma) {
  const f = await tx.formula.findUnique({ where: { id } })
  if (!f) return
  await replaceEntries(tx, 'formula', id, `${f.code} — ${f.name}`, f.productCategory, [
    { term: f.code, termKind: 'CODE', weight: 9 },
    { term: f.name, termKind: 'TITLE', weight: 7 },
  ], { ownerOrgId: f.ownerOrgId, visibility: f.visibility })
}

export async function reindexResearchCandidate(id: string, tx: Tx = prisma) {
  const c = await tx.researchCandidate.findUnique({ where: { id } })
  if (!c) return
  await replaceEntries(tx, 'research_candidate', id, `${c.code} — ${c.title}`, c.candidateType, [
    { term: c.code, termKind: 'CODE', weight: 9 },
    { term: c.title, termKind: 'TITLE', weight: 7 },
  ], { ownerOrgId: c.ownerOrgId, visibility: c.visibility })
}
