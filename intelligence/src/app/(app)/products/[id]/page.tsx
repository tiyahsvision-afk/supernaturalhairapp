import Link from 'next/link'
import { notFound } from 'next/navigation'
import { prisma } from '@/lib/db'
import { allowed, requireUser } from '@/lib/auth/next'
import { can } from '@/lib/permissions'
import type { ClaimFlag } from '@/lib/claims-guard'
import { Badge, Card, KeyValue, Notice, PageHeader, PermissionDenied, TableWrap, Button } from '@/components/ui'
import { addVersionAction, linkLineAction } from '../actions'

export const dynamic = 'force-dynamic'

export default async function ProductPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ v?: string }> }) {
  const s = await requireUser()
  if (!(await allowed(s, 'product:read', '/products/[id]'))) return <PermissionDenied permission="product:read" />
  const { id } = await params
  const sp = await searchParams
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound()
  const p = await prisma.product.findUnique({ where: { id }, include: { versions: { orderBy: { versionNumber: 'desc' }, include: { lines: { orderBy: { position: 'asc' }, include: { ingredient: true } } } } } })
  if (!p) notFound()
  const v = p.versions.find((x) => String(x.versionNumber) === sp.v) ?? p.versions[0]
  const src = v?.sourceId ? await prisma.source.findUnique({ where: { id: v.sourceId } }) : null
  const canWrite = can(s.principal, 'product:write')
  const ings = canWrite ? await prisma.ingredient.findMany({ where: { status: 'ACTIVE' }, select: { id: true, canonicalName: true }, orderBy: { canonicalName: 'asc' } }) : []
  const flags = (v?.claimFlags ?? []) as unknown as ClaimFlag[]
  return (
    <>
      <PageHeader eyebrow={p.isSupernatural ? 'Supernatural product' : 'Product'} title={`${p.brand} — ${p.name}`} subtitle={<>{p.category} · {p.applicationType.replace('_', '-').toLowerCase()} · {p.market}</>} actions={p.isSupernatural ? <Badge tone="brand">Priority 1</Badge> : undefined} />
      {flags.length > 0 && (
        <Notice kind="warn" title="Marketing language flagged for specialized review">
          <ul className="list-disc pl-5">{flags.map((f, i) => <li key={i}><strong>{f.term}</strong> ({f.category.replace(/_/g, ' ').toLowerCase()}): “…{f.excerpt}…”</li>)}</ul>
          <div className="mt-1 text-xs">Drug, medical, systemic-absorption and proof language requires regulatory/legal review. This screening is automated and not a legal classification.</div>
        </Notice>
      )}
      {v?.dataQualityNotes.length ? <Notice title="Data-quality notes"><ul className="list-disc pl-5">{v.dataQualityNotes.map((d, i) => <li key={i}>{d}</li>)}</ul></Notice> : null}
      <div className="mb-3 flex flex-wrap gap-2 text-sm">{p.versions.map((x) => <Link key={x.id} href={`/products/${p.id}?v=${x.versionNumber}`} className={`rounded-full border px-3 py-1 no-underline ${x.id === v.id ? 'border-brand bg-brand-100' : 'border-line'}`}>v{x.versionNumber} {x.validTo ? `(until ${x.validTo.toISOString().slice(0, 10)})` : '(current)'}</Link>)}</div>
      <div className="grid gap-4 lg:grid-cols-3">
        <Card title={`Ingredient list v${v.versionNumber} — ${v.lines.length} lines in displayed order`} className="lg:col-span-2">
          <TableWrap><table><thead><tr><th>#</th><th>Displayed name</th><th>Canonical ingredient</th><th>Identity</th>{canWrite && <th>Correct</th>}</tr></thead><tbody>
            {v.lines.map((l) => (
              <tr key={l.id}><td className="tabular-nums text-ink-3">{l.position}</td><td>{l.displayedName}</td>
                <td>{l.ingredient ? <Link href={`/ingredients/${l.ingredientId}`}>{l.ingredient.canonicalName}</Link> : <span className="text-ink-3">unresolved</span>}</td>
                <td><Badge tone={l.parsingStatus === 'MATCHED' ? 'good' : l.parsingStatus === 'UNMATCHED' ? 'bad' : 'warn'}>{l.parsingStatus.toLowerCase()} {l.identityConfidence.toFixed(2)}</Badge><div className="text-xs text-ink-3">{l.matchMethod?.replace(/_/g, ' ').toLowerCase()}{l.verificationStatus === 'VERIFIED' && ' · verified'}</div></td>
                {canWrite && <td>{l.parsingStatus !== 'MATCHED' && (
                  <form action={linkLineAction} className="flex gap-1"><input type="hidden" name="lineId" value={l.id} /><input name="ingredientId" list="ing-list" placeholder="ing:…" className="w-40 py-1 text-xs" /><button className="text-xs underline">Link</button></form>
                )}</td>}
              </tr>
            ))}
          </tbody></table></TableWrap>
          {canWrite && <datalist id="ing-list">{ings.map((i) => <option key={i.id} value={`ing:${i.id}`}>{i.canonicalName}</option>)}</datalist>}
          <p className="mt-2 text-xs text-ink-3">Order is preserved exactly as displayed and does not indicate concentration. Exposure concentration cannot be inferred from a label.</p>
        </Card>
        <Card title="Version provenance">
          <KeyValue items={[['List source', v.ingredientListSource.replace(/_/g, ' ').toLowerCase()], ['Source', src ? <Link key="s" href={`/sources/${src.id}`}>{src.name}</Link> : null], ['Source URL', v.sourceUrl ? <a key="u" href={v.sourceUrl} target="_blank" rel="noreferrer" className="break-all">{v.sourceUrl}</a> : null], ['Valid from', v.validFrom.toISOString().slice(0, 10)], ['Valid to', v.validTo?.toISOString().slice(0, 10) ?? 'current'], ['Barcode', p.barcode], ['Content hash', <code key="h" className="break-all text-xs">{v.contentHash.slice(0, 16)}…</code>]]} />
          <details className="mt-3 text-xs"><summary className="cursor-pointer text-ink-3">Raw list as captured</summary><p className="mt-1 whitespace-pre-wrap text-ink-2">{v.ingredientListRaw}</p></details>
        </Card>
      </div>
      {canWrite && (
        <Card title="Record a new ingredient list (formula-change detection)" className="mt-4">
          <form action={addVersionAction} className="grid gap-2 sm:grid-cols-3">
            <input type="hidden" name="productId" value={p.id} />
            <textarea name="ingredientList" rows={4} required className="sm:col-span-3" placeholder="Paste the current list. If it differs, a new version is created and the old one is kept for historical exposure." />
            <input name="url" type="url" placeholder="Source URL" /><input name="validFrom" type="date" />
            <Button variant="secondary">Check and record</Button>
          </form>
        </Card>
      )}
    </>
  )
}
