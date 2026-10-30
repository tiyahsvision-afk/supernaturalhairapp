/**
 * Bulk import of the EU CosIng inventory (seed/data/cosing/cosing-ingredients.json.gz).
 *
 * - Idempotent: rows whose CosIng reference already exists are skipped.
 * - Existing curated ingredients are linked to their CosIng record by exact INCI/name match, never by fuzzy match.
 * - New ingredients carry identity/material types assigned by naming rules (identityNote says so) and stay unreviewed.
 * - CAS/EC numbers are stored as reported by CosIng (UNVERIFIED); CAS check digits are validated and failures skipped.
 * - EU Annex references become EU regulatory records with no "last checked" date, so they display as needing
 *   verification against the current consolidated regulation.
 * Uses batched inserts so it completes in seconds against a remote database.
 */
import { randomUUID } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
import path from 'node:path'
import type { Prisma, RegulatoryStatus } from '@prisma/client'
import { prisma } from '../src/lib/db'
import { audit } from '../src/lib/audit'
import { importBlockedReason } from '../src/lib/import/engine'
import { classify, identityFromName, inciLabelCase, RULES_VERSION } from '../src/lib/classify'
import { isValidCas, isValidEc, normalizeIdentifier, normalizeName, slugify } from '../src/lib/normalize'
import type { Principal } from '../src/lib/permissions'

interface Row { i: string; r?: string; a?: string[]; c?: string[]; e?: string[]; f?: string[]; d?: string; x?: string; w?: string; u?: string }

const BATCH = 1000
const chunks = <T,>(xs: T[], n = BATCH) => Array.from({ length: Math.ceil(xs.length / n) }, (_, k) => xs.slice(k * n, k * n + n))

const ANNEX_STATUS: Record<string, { status: RegulatoryStatus; label: string }> = {
  II: { status: 'PROHIBITED', label: 'Annex II (prohibited substances)' },
  III: { status: 'RESTRICTED', label: 'Annex III (restricted substances)' },
  IV: { status: 'CONDITIONALLY_PERMITTED', label: 'Annex IV (allowed colorants, with conditions)' },
  V: { status: 'CONDITIONALLY_PERMITTED', label: 'Annex V (allowed preservatives, with limits)' },
  VI: { status: 'CONDITIONALLY_PERMITTED', label: 'Annex VI (allowed UV filters, with limits)' },
}

export function parseAnnex(ref: string): { annex: string; refs: string[] } | null {
  const refs = [...ref.matchAll(/\b(II|III|IV|V|VI)\/[IVX]*\/?\d+[a-z]?/g)].map((m) => m[0])
  if (!refs.length) return null
  // Most restrictive annex wins when several are listed.
  const order = ['II', 'III', 'V', 'VI', 'IV']
  const annex = order.find((a) => refs.some((r) => r.startsWith(`${a}/`)))!
  return { annex, refs }
}

export async function importCosing(actor: Principal, sourceId: string, file = path.join(__dirname, 'data', 'cosing', 'cosing-ingredients.json.gz')) {
  const source = await prisma.source.findUniqueOrThrow({ where: { id: sourceId } })
  const blocked = importBlockedReason(source)
  if (blocked) throw new Error(blocked)
  const { rows, _meta } = JSON.parse(gunzipSync(readFileSync(file)).toString('utf8')) as { rows: Row[]; _meta: { url: string } }
  const t0 = Date.now()

  const existing = await prisma.ingredient.findMany({ select: { id: true, slug: true, cosingRef: true, cosingFunctions: true, canonicalName: true, inciName: true, names: { select: { normalized: true, nameType: true } } } })
  const refs = new Set(existing.map((e) => e.cosingRef).filter(Boolean) as string[])
  const slugs = new Set(existing.map((e) => e.slug))
  // Exact INCI/canonical name → existing ingredient without a CosIng link
  const byName = new Map<string, string>()
  for (const e of existing.filter((x) => !x.cosingRef)) {
    for (const n of [e.canonicalName, e.inciName].filter(Boolean) as string[]) byName.set(normalizeName(n), e.id)
    for (const n of e.names.filter((x) => x.nameType === 'INCI')) byName.set(n.normalized, e.id)
  }

  // A few CosIng-derived records have no reference number; those are keyed by exact INCI name instead.
  const importedNames = new Set(existing.filter((e) => e.cosingRef || e.cosingFunctions.length).flatMap((e) => [e.canonicalName, e.inciName].filter(Boolean).map((n) => normalizeName(n as string))))
  const todo = rows.filter((r) => (r.r ? !refs.has(r.r) : !importedNames.has(normalizeName(r.i))))
  // Refresh CosIng-owned fields on rows imported earlier when the source data changed (e.g. a corrected parser).
  const byRef = new Map(existing.filter((e) => e.cosingRef).map((e) => [e.cosingRef!, e]))
  let refreshed = 0
  for (const row of rows) {
    const e = row.r ? byRef.get(row.r) : undefined
    if (!e) continue
    const fns = row.f ?? []
    if (fns.length !== e.cosingFunctions.length || fns.some((f, k) => f !== e.cosingFunctions[k])) {
      await prisma.ingredient.update({ where: { id: e.id }, data: { cosingFunctions: fns, derivedClasses: classify(row.i, fns).map((c) => c.code), derivedVersion: RULES_VERSION } })
      refreshed++
    }
  }
  const linked: { id: string; row: Row }[] = []
  const created: { id: string; row: Row }[] = []
  const usedExisting = new Set<string>()
  for (const row of todo) {
    const hit = byName.get(normalizeName(row.i))
    if (hit && !usedExisting.has(hit)) { linked.push({ id: hit, row }); usedExisting.add(hit) }
    else created.push({ id: randomUUID(), row })
  }

  const cosingFields = (row: Row) => {
    const fns = row.f ?? []
    return {
      cosingRef: row.r ?? null, cosingFunctions: fns, cosingDescription: row.d ?? null, cosingRestriction: row.x ?? null, cosingUpdated: row.u ?? null, wikidataId: row.w ?? null,
      derivedClasses: classify(row.i, fns).map((c) => c.code), derivedVersion: RULES_VERSION,
    }
  }

  // 1. Link existing curated records (identity fields untouched).
  for (const { id, row } of linked) await prisma.ingredient.update({ where: { id }, data: cosingFields(row) })

  // 2. New canonical ingredients.
  const newIngredients: Prisma.IngredientCreateManyInput[] = created.map(({ id, row }) => {
    const label = inciLabelCase(row.i)
    let slug = slugify(row.i) || `cosing-${row.r ?? 'noref'}`
    if (slugs.has(slug)) slug = `${slug}-${row.r ?? id.slice(0, 8)}`.slice(0, 90)
    slugs.add(slug)
    const t = identityFromName(row.i, row.f ?? [])
    return {
      id, slug, canonicalName: label, inciName: label, displayName: label, identityType: t.identityType as never, materialType: t.materialType as never, originType: 'UNKNOWN',
      reviewStatus: 'SUBMITTED', identityNote: `Imported from EU CosIng (${row.r ? `ref ${row.r}` : 'record without a reference number'}). Identity and material type assigned by naming rules (${RULES_VERSION}); not reviewed.`,
      ...cosingFields(row),
    }
  })
  for (const c of chunks(newIngredients)) await prisma.ingredient.createMany({ data: c, skipDuplicates: true })

  // 3. Names, aliases, identifiers (for both linked and new).
  const all = [...linked, ...created]
  const names: Prisma.IngredientNameCreateManyInput[] = created.map(({ id, row }) => ({ ingredientId: id, name: inciLabelCase(row.i), normalized: normalizeName(row.i), nameType: 'INCI', isPreferred: true, sourceId, reviewStatus: 'SUBMITTED' }))
  const aliases: Prisma.IngredientAliasCreateManyInput[] = []
  const identifiers: Prisma.IngredientIdentifierCreateManyInput[] = []
  let casRejected = 0
  for (const { id, row } of all) {
    const seen = new Set([normalizeName(row.i)])
    for (const a of row.a ?? []) {
      const n = normalizeName(a)
      if (!n || seen.has(n)) continue
      seen.add(n)
      aliases.push({ ingredientId: id, alias: a, normalized: n, aliasType: 'SYNONYM', sourceId })
    }
    const loc = row.r ? `CosIng ref ${row.r}` : `CosIng record ${row.i}`
    if (row.r) identifiers.push({ ingredientId: id, type: 'COSING_REF', value: row.r, normalized: row.r, sourceId, sourceLocation: loc, verificationStatus: 'UNVERIFIED', reviewStatus: 'SUBMITTED' })
    for (const cas of row.c ?? []) {
      if (!isValidCas(cas)) { casRejected++; continue }
      identifiers.push({ ingredientId: id, type: 'CAS', value: cas, normalized: normalizeIdentifier('CAS', cas), sourceId, sourceLocation: loc, verificationStatus: 'UNVERIFIED', reviewStatus: 'SUBMITTED' })
    }
    for (const ec of row.e ?? []) {
      if (!isValidEc(ec)) continue
      identifiers.push({ ingredientId: id, type: 'EC', value: ec, normalized: normalizeIdentifier('EC', ec), sourceId, sourceLocation: loc, verificationStatus: 'UNVERIFIED', reviewStatus: 'SUBMITTED' })
    }
  }
  for (const c of chunks(names)) await prisma.ingredientName.createMany({ data: c, skipDuplicates: true })
  for (const c of chunks(aliases)) await prisma.ingredientAlias.createMany({ data: c, skipDuplicates: true })
  for (const c of chunks(identifiers)) await prisma.ingredientIdentifier.createMany({ data: c, skipDuplicates: true })

  // 4. EU regulatory records from Annex references, plus graph edges.
  const regs: Prisma.RegulatoryRecordCreateManyInput[] = []
  const edges: Prisma.GraphEdgeCreateManyInput[] = []
  for (const { id, row } of all) {
    const ax = row.x ? parseAnnex(row.x) : null
    if (!ax) continue
    const meta = ANNEX_STATUS[ax.annex]
    regs.push({
      ingredientId: id, jurisdiction: 'EU', authority: 'European Commission', regulationRef: `Reg. (EC) 1223/2009 ${ax.refs.join(', ')}`, status: meta.status, sourceId,
      sourceUrl: 'https://ec.europa.eu/growth/tools-databases/cosing/', entryMode: 'IMPORTED', reviewStatus: 'SUBMITTED', lastCheckedAt: null,
      notes: `${meta.label}. Reference as listed in CosIng. Maximum concentrations and conditions of use are in the Annex entry and are not yet loaded; verify against the current consolidated regulation.`,
    })
    edges.push({ fromType: 'Ingredient', fromId: id, toType: 'Regulation', toId: `EU:1223/2009:${ax.refs[0]}`, edgeType: meta.status === 'PROHIBITED' ? 'PROHIBITED_BY' : 'RESTRICTED_BY', sourceId, confidence: 0.9, evidenceType: 'REGULATORY_LIST', properties: { annex: ax.annex, refs: ax.refs } })
  }
  const already = new Set((await prisma.regulatoryRecord.findMany({ where: { sourceId }, select: { ingredientId: true } })).map((r) => r.ingredientId))
  const newRegs = regs.filter((r) => !already.has(r.ingredientId))
  for (const c of chunks(newRegs)) await prisma.regulatoryRecord.createMany({ data: c })
  for (const c of chunks(edges)) await prisma.graphEdge.createMany({ data: c, skipDuplicates: true })

  // 5. Search index entries for new ingredients; linked ones are reindexed individually.
  const entries: Prisma.SearchEntryCreateManyInput[] = []
  for (const { id, row } of created) {
    const label = inciLabelCase(row.i)
    const detail = [row.r ? `CosIng ${row.r}` : 'CosIng', (row.f ?? []).slice(0, 3).join(', ')].filter(Boolean).join(' · ')
    const seen = new Set<string>()
    const push = (term: string, termKind: string, weight: number, normalized = normalizeName(term)) => {
      const k = `${normalized}|${termKind}`
      if (!normalized || seen.has(k)) return
      seen.add(k)
      entries.push({ entityType: 'ingredient', entityId: id, term, normalized, termKind, label, detail, weight })
    }
    push(label, 'CANONICAL', 10)
    push(label, 'INCI', 10)
    for (const a of row.a ?? []) push(a, 'ALIAS', 5)
    for (const cas of (row.c ?? []).filter(isValidCas)) push(cas, 'IDENTIFIER', 8, normalizeIdentifier('CAS', cas).toLowerCase())
    for (const ec of (row.e ?? []).filter(isValidEc)) push(ec, 'IDENTIFIER', 8, normalizeIdentifier('EC', ec).toLowerCase())
    if (row.r) push(row.r, 'IDENTIFIER', 6, row.r)
  }
  for (const c of chunks(entries, 2000)) await prisma.searchEntry.createMany({ data: c })
  const { reindexIngredient } = await import('../src/lib/search-index')
  for (const { id } of linked) await reindexIngredient(id)

  await prisma.source.update({ where: { id: sourceId }, data: { lastSuccessfulImportAt: new Date(), lastAttemptedImportAt: new Date(), recordCount: { increment: created.length }, parserVersion: 'cosing-obf/1.0.0' } })
  await audit(actor, { action: 'ingredient.bulk_import', entityType: 'Source', entityId: sourceId, sourceId, after: { source: _meta.url, rows: rows.length, refreshed, skippedExisting: rows.length - todo.length, linked: linked.length, created: created.length, identifiers: identifiers.length, casRejected, regulatoryRecords: newRegs.length, rulesVersion: RULES_VERSION } })
  return { rows: rows.length, refreshed, skipped: rows.length - todo.length, linked: linked.length, created: created.length, identifiers: identifiers.length, casRejected, regulatory: newRegs.length, seconds: (Date.now() - t0) / 1000 }
}

/** Recomputes the rule-derived class cache for every ingredient whose rules version is out of date (batched). */
export async function refreshDerivedClasses() {
  const rows = await prisma.ingredient.findMany({ where: { OR: [{ derivedVersion: null }, { derivedVersion: { not: RULES_VERSION } }] }, select: { id: true, inciName: true, canonicalName: true, cosingFunctions: true } })
  for (const c of chunks(rows, 2000)) {
    const payload = JSON.stringify(c.map((r) => ({ id: r.id, c: classify(r.inciName ?? r.canonicalName, r.cosingFunctions).map((x) => x.code) })))
    await prisma.$executeRaw`
      UPDATE "Ingredient" AS i SET "derivedClasses" = ARRAY(SELECT jsonb_array_elements_text(v.c)), "derivedVersion" = ${RULES_VERSION}
      FROM jsonb_to_recordset(${payload}::jsonb) AS v(id uuid, c jsonb) WHERE i.id = v.id`
  }
  return rows.length
}
