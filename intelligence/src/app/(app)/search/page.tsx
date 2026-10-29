import Link from 'next/link'
import { requireUser, allowed } from '@/lib/auth/next'
import { can } from '@/lib/permissions'
import { search, logSearch } from '@/lib/search'
import { prisma } from '@/lib/db'
import { Badge, EmptyState, LinkButton, PageHeader, PermissionDenied } from '@/components/ui'
import { saveSearchAction } from './actions'

export const dynamic = 'force-dynamic'

const HREF: Record<string, (id: string) => string> = {
  ingredient: (id) => `/ingredients/${id}`, product: (id) => `/products/${id}`, patent: (id) => `/patents/${id}`, evidence: (id) => `/evidence/${id}`,
  supplier: () => '/suppliers', raw_material: (id) => `/raw-materials/${id}`, formula: (id) => `/formulas/${id}`, research_candidate: () => '/research-candidates',
}
const TYPES = ['ingredient', 'product', 'evidence', 'patent', 'formula', 'raw_material', 'supplier', 'research_candidate']

export default async function SearchPage({ searchParams }: { searchParams: Promise<{ q?: string; type?: string }> }) {
  const s = await requireUser()
  if (!(await allowed(s, 'search:read', '/search'))) return <PermissionDenied permission="search:read" />
  const { q = '', type } = await searchParams
  const res = q ? await search(s.principal, q, { types: type ? [type] : undefined, limit: 60 }) : null
  if (res) await logSearch(s.user.id, q, { type }, res.hits.length, res.durationMs)
  const [saved, recent] = await Promise.all([
    prisma.savedSearch.findMany({ where: { userId: s.user.id }, orderBy: { createdAt: 'desc' }, take: 10 }),
    prisma.searchLog.findMany({ where: { userId: s.user.id }, orderBy: { createdAt: 'desc' }, take: 8, distinct: ['query'] }),
  ])
  return (
    <>
      <PageHeader title="Search" subtitle="Ranking: exact canonical/INCI → exact identifier → exact synonym → prefix → fuzzy. Semantic search (Phase 4) will never outrank an exact identifier match." />
      <form className="mb-4 flex flex-wrap gap-2">
        <input name="q" defaultValue={q} placeholder="e.g. Provitamin B5, 56-81-5, glycerol, PEDCQBHIVMGVHV-UHFFFAOYSA-N, US9480629B2" className="min-w-64 flex-1" />
        <select name="type" defaultValue={type ?? ''} className="w-auto"><option value="">All types</option>{TYPES.map((t) => <option key={t} value={t}>{t.replace('_', ' ')}</option>)}</select>
        <button className="rounded-full border border-brand bg-brand px-4 py-1.5 text-sm font-medium text-[#0d2440]">Search</button>
      </form>
      {res && (
        <>
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2 text-xs text-ink-3">
            <span>{res.hits.length} result(s) in {res.durationMs} ms</span>
            <form action={saveSearchAction} className="flex gap-2"><input type="hidden" name="q" value={q} /><input type="hidden" name="type" value={type ?? ''} /><input name="name" placeholder="Save as…" className="w-40 py-1 text-xs" /><button className="text-xs underline">Save search</button></form>
          </div>
          {res.hits.length === 0 ? (
            <EmptyState title={`No results for “${q}”`} action={can(s.principal, 'ingredient:write') ? <LinkButton href="/ingredients/new">Submit an unresolved identity for review</LinkButton> : undefined}>
              {res.suggestions.length > 0 ? <>Did you mean: {res.suggestions.map((x, i) => <span key={x}>{i > 0 && ', '}<Link href={`/search?q=${encodeURIComponent(x)}`}>{x}</Link></span>)}?</> : 'Try a synonym, INCI name, CAS number or PubChem CID.'}
            </EmptyState>
          ) : (
            <ul className="divide-y divide-line rounded-2xl border border-line">
              {res.hits.map((h) => (
                <li key={`${h.entityType}:${h.entityId}`} className="flex flex-col gap-1 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0"><Link href={HREF[h.entityType](h.entityId)} className="font-medium">{h.label}</Link>{h.detail && <div className="text-xs text-ink-3">{h.detail}</div>}<div className="text-xs text-brand-700">{h.why}</div></div>
                  <Badge>{h.entityType.replace('_', ' ')}</Badge>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
      {!q && (
        <div className="grid gap-4 md:grid-cols-2">
          <div><h2 className="mb-2 text-lg">Saved searches</h2>{saved.length === 0 ? <p className="text-sm text-ink-3">None yet.</p> : <ul className="text-sm">{saved.map((x) => <li key={x.id}><Link href={`/search?q=${encodeURIComponent(x.query)}${(x.filters as { type?: string }).type ? `&type=${(x.filters as { type?: string }).type}` : ''}`}>{x.name}</Link> <span className="text-ink-3">“{x.query}”</span></li>)}</ul>}</div>
          <div><h2 className="mb-2 text-lg">Recent searches</h2>{recent.length === 0 ? <p className="text-sm text-ink-3">None yet.</p> : <ul className="text-sm">{recent.map((x) => <li key={x.id}><Link href={`/search?q=${encodeURIComponent(x.query)}`}>{x.query}</Link> <span className="text-ink-3">{x.resultCount} results</span></li>)}</ul>}</div>
        </div>
      )}
    </>
  )
}
