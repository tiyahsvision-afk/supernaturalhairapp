import Link from 'next/link'
import { prisma } from '@/lib/db'
import { allowed, requireUser } from '@/lib/auth/next'
import { DERIVED_FILTERS } from '@/lib/classify'
import { Card, PageHeader, PermissionDenied, TableWrap, Notice } from '@/components/ui'

export const dynamic = 'force-dynamic'

const CLASSES = ['sulfate-surfactant', 'silicone', 'protein', 'cationic', 'fatty-alcohol', 'humectant', 'botanical', 'preservative', 'eu-fragrance-allergen', 'cg-avoid']

export default async function ProductBenchmark({ searchParams }: { searchParams: Promise<{ id?: string | string[] }> }) {
  const s = await requireUser()
  if (!(await allowed(s, 'product:read', '/products/compare'))) return <PermissionDenied permission="product:read" />
  const sp = await searchParams
  const ids = ([] as string[]).concat(sp.id ?? []).filter((x) => /^[0-9a-f-]{36}$/.test(x)).slice(0, 4)
  const visible = { OR: [{ ownerOrgId: null }, { ownerOrgId: s.principal.organizationId }] }
  const all = await prisma.product.findMany({ where: visible, orderBy: [{ brand: 'asc' }, { name: 'asc' }], select: { id: true, brand: true, name: true, category: true } })
  const products = ids.length ? await prisma.product.findMany({ where: { AND: [visible, { id: { in: ids } }] }, include: { versions: { where: { validTo: null }, include: { lines: { orderBy: { position: 'asc' }, include: { ingredient: { select: { id: true, displayName: true, derivedClasses: true } } } } } } } }) : []
  const lines = products.map((p) => ({ p, lines: p.versions[0]?.lines ?? [] }))
  const keyOf = (l: { ingredientId: string | null; normalizedName: string }) => l.ingredientId ?? `name:${l.normalizedName}`
  const union = new Map<string, { label: string; href?: string; best: number }>()
  for (const { lines: ls } of lines) for (const l of ls) {
    const k = keyOf(l)
    const cur = union.get(k)
    if (!cur || l.position < cur.best) union.set(k, { label: l.ingredient?.displayName ?? l.displayedName, href: l.ingredient ? `/ingredients/${l.ingredient.id}` : undefined, best: l.position })
  }
  const rows = [...union.entries()].sort((a, b) => a[1].best - b[1].best)
  const sets = lines.map(({ lines: ls }) => new Set(ls.map(keyOf)))
  const shared = rows.filter(([k]) => sets.every((st) => st.has(k)))
  // Ingredient frequency across products in the same categories (this database only).
  const cats = [...new Set(products.map((p) => p.category).filter(Boolean))] as string[]
  const freq = cats.length ? await prisma.productIngredient.groupBy({ by: ['ingredientId'], where: { ingredientId: { not: null }, productVersion: { validTo: null, product: { AND: [visible, { category: { in: cats } }] } } }, _count: true, orderBy: { _count: { ingredientId: 'desc' } }, take: 15 }) : []
  const freqNames = await prisma.ingredient.findMany({ where: { id: { in: freq.map((f) => f.ingredientId!) } }, select: { id: true, displayName: true } })
  const catTotal = cats.length ? await prisma.product.count({ where: { AND: [visible, { category: { in: cats } }] } }) : 0
  const label = (code: string) => DERIVED_FILTERS.find((d) => d.code === code)?.label ?? code.replace(/-/g, ' ')
  return (
    <>
      <PageHeader eyebrow="Product intelligence" title="Product ingredient benchmark" subtitle="Compare declared ingredient lists side by side. List position reflects label order only; it does not reveal concentrations, manufacturing methods or performance." />
      <form className="mb-6 rounded-2xl border border-line bg-paper-2 p-4">
        <div className="mb-2 text-sm font-medium">Choose up to four products</div>
        <div className="grid max-h-64 gap-1.5 overflow-y-auto sm:grid-cols-2">{all.map((p) => <label key={p.id} className="inline-flex items-center gap-2 text-sm"><input type="checkbox" name="id" value={p.id} defaultChecked={ids.includes(p.id)} />{p.brand} — {p.name}</label>)}</div>
        <button className="mt-3 rounded-full border border-brand bg-brand px-4 py-1.5 text-sm font-semibold text-[#0d2440]">Compare</button>
      </form>
      {products.length < 2 ? <Notice title="Select at least two products">Pick products above to see shared and unique ingredients.</Notice> : (
        <div className="space-y-6">
          <div className="grid gap-4 md:grid-cols-2">
            <Card title={`Shared by all (${shared.length})`}><p className="text-sm text-ink-2">{shared.map(([, v]) => v.label).join(', ') || 'None'}</p></Card>
            <Card title="Class profile (rule-based)">
              <TableWrap><table><thead><tr><th>Class</th>{lines.map(({ p }) => <th key={p.id} className="text-right">{p.brand}</th>)}</tr></thead><tbody>
                {CLASSES.map((c) => <tr key={c}><td className="text-xs">{label(c)}</td>{lines.map(({ p, lines: ls }) => <td key={p.id} className="text-right tabular-nums">{ls.filter((l) => l.ingredient?.derivedClasses.includes(c)).length || '—'}</td>)}</tr>)}
              </tbody></table></TableWrap>
            </Card>
          </div>
          <Card title="Side-by-side (label position)">
            <TableWrap><table>
              <thead><tr><th>Ingredient</th>{lines.map(({ p }) => <th key={p.id} className="text-right"><Link href={`/products/${p.id}`}>{p.brand} {p.name}</Link></th>)}</tr></thead>
              <tbody>{rows.map(([k, v]) => <tr key={k}><td>{v.href ? <Link href={v.href}>{v.label}</Link> : <span>{v.label} <span className="text-xs text-ink-3">(unidentified)</span></span>}</td>{lines.map(({ p, lines: ls }) => { const l = ls.find((x) => keyOf(x) === k); return <td key={p.id} className="text-right tabular-nums">{l ? `#${l.position}` : <span className="text-ink-3">—</span>}</td> })}</tr>)}</tbody>
            </table></TableWrap>
          </Card>
          {freq.length > 0 && (
            <Card title={`Most frequent ingredients in ${cats.join(', ')} products (this database, n=${catTotal})`}>
              <ol className="grid gap-1 text-sm sm:grid-cols-2">{freq.map((f) => <li key={f.ingredientId}><Link href={`/ingredients/${f.ingredientId}`}>{freqNames.find((n) => n.id === f.ingredientId)?.displayName}</Link> <span className="text-xs text-ink-3">in {f._count} of {catTotal}</span></li>)}</ol>
              <p className="mt-2 text-xs text-ink-3">A small sample of products recorded in this database — not market-wide trend data.</p>
            </Card>
          )}
        </div>
      )}
    </>
  )
}
