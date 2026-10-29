import Link from 'next/link'
import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/db'
import { allowed, requireUser } from '@/lib/auth/next'
import { can } from '@/lib/permissions'
import { ingredientWhere, type IngredientFilters } from '@/lib/services/ingredients'
import { search } from '@/lib/search'
import { Badge, LinkButton, PageHeader, Pagination, PermissionDenied, TableWrap, EmptyState } from '@/components/ui'

export const dynamic = 'force-dynamic'
const PAGE = 50

type SP = Record<string, string | undefined>

export default async function IngredientsPage({ searchParams }: { searchParams: Promise<SP> }) {
  const s = await requireUser()
  if (!(await allowed(s, 'ingredient:read', '/ingredients'))) return <PermissionDenied permission="ingredient:read" />
  const sp = await searchParams
  const page = Math.max(1, Number(sp.page ?? 1))
  const filters: IngredientFilters = {
    functionCode: sp.fn || undefined, materialType: (sp.material as never) || undefined, familySlug: sp.family || undefined, priorityTier: sp.tier ? Number(sp.tier) : undefined,
    minEvidenceLevel: sp.level ? Number(sp.level) : undefined, humanEvidence: sp.human === '1', texturedHairEvidence: sp.textured === '1', regulatoryJurisdiction: sp.jur || undefined,
    regulatoryStatus: sp.regstatus || undefined, hasSupplierDocuments: sp.docs === '1', leaveOnCompatible: sp.leaveon === '1', unresolvedSafety: sp.safety === '1', inSupernaturalProduct: sp.sn === '1',
  }
  let where: Prisma.IngredientWhereInput = ingredientWhere(filters)
  let matchNote: Map<string, string> | null = null
  if (sp.q) {
    const res = await search(s.principal, sp.q, { types: ['ingredient'], limit: 100 })
    matchNote = new Map(res.hits.map((h) => [h.entityId, h.why]))
    where = { AND: [where, { id: { in: res.hits.map((h) => h.entityId) } }] }
  }
  const [rows, total, functions, families] = await Promise.all([
    prisma.ingredient.findMany({ where, skip: (page - 1) * PAGE, take: PAGE, orderBy: sp.sort === 'name' ? { displayName: 'asc' } : [{ priorityTier: 'asc' }, { displayName: 'asc' }], include: { family: true, functions: { include: { function: true } }, _count: { select: { identifiers: { where: { verificationStatus: 'VERIFIED' } }, evidenceLinks: true, regulatory: true } } } }),
    prisma.ingredient.count({ where }),
    prisma.functionTerm.findMany({ orderBy: { label: 'asc' } }),
    prisma.ingredientFamily.findMany({ orderBy: { name: 'asc' } }),
  ])
  if (matchNote) rows.sort((a, b) => [...matchNote!.keys()].indexOf(a.id) - [...matchNote!.keys()].indexOf(b.id))
  const qs = new URLSearchParams(Object.entries(sp).filter(([k, v]) => v && k !== 'page') as [string, string][]).toString()
  return (
    <>
      <PageHeader eyebrow="Canonical identities" title="Ingredients" subtitle="Each canonical ingredient has its own names, identifiers and source-backed facts. Similar names are never merged automatically."
        actions={can(s.principal, 'ingredient:write') ? <LinkButton href="/ingredients/new" variant="primary">New ingredient</LinkButton> : undefined} />
      <form className="mb-5 grid gap-3 rounded-2xl border border-line bg-paper-2 p-4 sm:grid-cols-2 lg:grid-cols-4">
        <input name="q" defaultValue={sp.q} placeholder="Name, INCI, synonym, CAS, CID…" className="sm:col-span-2" />
        <select name="fn" defaultValue={sp.fn ?? ''}><option value="">Any function</option>{functions.map((f) => <option key={f.code} value={f.code}>{f.label}</option>)}</select>
        <select name="family" defaultValue={sp.family ?? ''}><option value="">Any family</option>{families.map((f) => <option key={f.slug} value={f.slug}>{f.name}</option>)}</select>
        <select name="tier" defaultValue={sp.tier ?? ''}><option value="">Any priority tier</option>{[1, 2, 3, 4, 5, 6].map((t) => <option key={t} value={t}>Tier {t}</option>)}</select>
        <select name="level" defaultValue={sp.level ?? ''}><option value="">Any evidence level</option>{[3, 4, 5, 6, 7].map((l) => <option key={l} value={l}>Evidence level {l}+</option>)}</select>
        <select name="jur" defaultValue={sp.jur ?? ''}><option value="">Any jurisdiction</option>{['EU', 'US', 'UK', 'CA'].map((j) => <option key={j}>{j}</option>)}</select>
        <select name="regstatus" defaultValue={sp.regstatus ?? ''}><option value="">Any regulatory status</option>{['RESTRICTED', 'PROHIBITED', 'CONDITIONALLY_PERMITTED', 'NOT_A_COSMETIC_INGREDIENT'].map((r) => <option key={r} value={r}>{r.replace(/_/g, ' ').toLowerCase()}</option>)}</select>
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm sm:col-span-2 lg:col-span-3">
          {[['human', 'Human evidence'], ['textured', 'Studied in textured hair'], ['sn', 'In Supernatural products'], ['leaveon', 'Leave-on compatible (no recorded rinse-off-only restriction)'], ['docs', 'Supplier documents'], ['safety', 'Unresolved safety review']].map(([k, l]) => (
            <label key={k} className="inline-flex items-center gap-1.5"><input type="checkbox" name={k} value="1" defaultChecked={sp[k] === '1'} />{l}</label>
          ))}
        </div>
        <button className="rounded-full border border-brand bg-brand px-4 py-1.5 text-sm font-medium text-[#0d2440]">Apply</button>
      </form>
      {rows.length === 0 ? (
        <EmptyState title="No ingredients match" action={can(s.principal, 'ingredient:write') ? <LinkButton href="/ingredients/new">Submit a new ingredient for identity review</LinkButton> : undefined}>Try fewer filters, or search by synonym, INCI name, CAS or PubChem CID.</EmptyState>
      ) : (
        <TableWrap>
          <table>
            <thead><tr><th>Ingredient</th><th>Identity</th><th>Functions (proposed)</th><th>Tier</th><th className="text-right">Verified IDs</th><th className="text-right">Evidence</th><th className="text-right">Regulatory</th></tr></thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td className="min-w-56"><Link href={`/ingredients/${r.id}`} className="font-medium">{r.displayName}</Link>{r.inciName && r.inciName !== r.displayName && <div className="text-xs text-ink-3">INCI: {r.inciName}</div>}{matchNote?.get(r.id) && <div className="text-xs text-brand-700">{matchNote.get(r.id)}</div>}</td>
                  <td className="text-xs text-ink-2">{r.identityType.replace(/_/g, ' ').toLowerCase()}<div className="text-ink-3">{r.family?.name}</div></td>
                  <td className="text-xs">{r.functions.slice(0, 3).map((f) => f.function.label).join(', ')}</td>
                  <td><Badge>{r.priorityTier ?? '—'}</Badge></td>
                  <td className="text-right tabular-nums">{r._count.identifiers}</td>
                  <td className="text-right tabular-nums">{r._count.evidenceLinks}</td>
                  <td className="text-right tabular-nums">{r._count.regulatory}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </TableWrap>
      )}
      <Pagination page={page} pageSize={PAGE} total={total} base={`/ingredients${qs ? `?${qs}` : ''}`} />
    </>
  )
}
