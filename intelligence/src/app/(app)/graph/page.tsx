import Link from 'next/link'
import type { NodeType } from '@prisma/client'
import { allowed, requireUser } from '@/lib/auth/next'
import { postgresGraphStore } from '@/lib/services/graph'
import { prisma } from '@/lib/db'
import { GraphSvg } from '@/components/GraphSvg'
import { Badge, Card, EmptyState, PageHeader, PermissionDenied, TableWrap } from '@/components/ui'

export const dynamic = 'force-dynamic'
const EDGE_TYPES = ['CONTAINS', 'USED_IN', 'HAS_FUNCTION', 'MEMBER_OF', 'STUDIED_IN', 'SUPPORTS', 'CONTRADICTS', 'ASSOCIATED_WITH', 'CLAIMED_IN_PATENT', 'RESTRICTED_BY', 'PROHIBITED_BY', 'DERIVED_FROM', 'TARGETS_PHENOTYPE', 'SUPPLIED_BY', 'INCOMPATIBLE_WITH']
const TYPES: NodeType[] = ['Ingredient', 'Product', 'Study', 'Patent']

export default async function GraphPage({ searchParams }: { searchParams: Promise<{ type?: string; id?: string; q?: string; edges?: string | string[] }> }) {
  const s = await requireUser()
  if (!(await allowed(s, 'graph:read', '/graph'))) return <PermissionDenied permission="graph:read" />
  const sp = await searchParams
  const type = (TYPES.includes(sp.type as NodeType) ? sp.type : 'Ingredient') as NodeType
  let id = sp.id
  if (!id && sp.q) {
    const hit = await prisma.ingredient.findFirst({ where: { status: 'ACTIVE', OR: [{ displayName: { contains: sp.q, mode: 'insensitive' } }, { canonicalName: { contains: sp.q, mode: 'insensitive' } }] }, orderBy: { priorityTier: 'asc' } })
    id = hit?.id
  }
  if (!id) id = (await prisma.ingredient.findFirst({ where: { slug: 'panthenol' } }))?.id
  const edgeTypes = sp.edges ? (Array.isArray(sp.edges) ? sp.edges : [sp.edges]) : []
  const g = id ? await postgresGraphStore.neighborhood(s.principal, type, id, { edgeTypes, limit: 80 }) : null
  const counts = await prisma.graphEdge.groupBy({ by: ['edgeType', 'reviewStatus'], _count: true })
  return (
    <>
      <PageHeader eyebrow="Typed, provenance-bearing relationships" title="Knowledge graph" subtitle="Select a node to explore. Every edge carries its source, confidence, status and review state; unreviewed edges are dashed." />
      <form className="mb-4 grid gap-2 rounded-2xl border border-line bg-paper-2 p-4 sm:grid-cols-[1fr_auto]">
        <input name="q" placeholder="Ingredient name (e.g. castor, panthenol, piroctone)" defaultValue={sp.q} />
        <button className="rounded-full border border-brand bg-brand px-4 py-1.5 text-sm font-medium text-[#0d2440]">Explore</button>
        <fieldset className="flex flex-wrap gap-x-3 gap-y-1 text-xs sm:col-span-2"><legend className="mb-1 text-ink-3">Edge types (none = all)</legend>
          {EDGE_TYPES.map((e) => <label key={e} className="inline-flex items-center gap-1"><input type="checkbox" name="edges" value={e} defaultChecked={edgeTypes.includes(e)} />{e.toLowerCase().replace(/_/g, ' ')}</label>)}
          {id && <><input type="hidden" name="id" value={id} /><input type="hidden" name="type" value={type} /></>}
        </fieldset>
      </form>
      {!g || g.nodes.length === 0 ? <EmptyState title="No graph data for this selection" /> : (
        <>
          <GraphSvg focusKey={`${type}:${id}`} nodes={g.nodes} links={g.links} />
          <Card title={`Relationships (${g.links.length})`} className="mt-4">
            <TableWrap><table><thead><tr><th>From</th><th>Relationship</th><th>To</th><th>Confidence</th><th>Status</th><th>Evidence type</th></tr></thead><tbody>
              {g.links.map((l) => { const a = g.nodes.find((n) => `${n.type}:${n.id}` === l.from)!, b = g.nodes.find((n) => `${n.type}:${n.id}` === l.to)!; return (
                <tr key={l.id}><td>{a.href ? <Link href={a.href}>{a.label}</Link> : a.label}</td><td><Badge>{String(l.edgeType).toLowerCase().replace(/_/g, ' ')}</Badge></td><td>{b.href ? <Link href={b.href}>{b.label}</Link> : b.label}</td><td className="tabular-nums">{l.confidence.toFixed(2)}</td><td className="text-xs">{l.status.toLowerCase()} · {l.reviewStatus.toLowerCase()}</td><td className="text-xs text-ink-3">{l.source}</td></tr>) })}
            </tbody></table></TableWrap>
          </Card>
        </>
      )}
      <Card title="Graph totals by relationship and review state" className="mt-4">
        <TableWrap><table><thead><tr><th>Relationship</th><th>Review state</th><th className="text-right">Edges</th></tr></thead><tbody>
          {counts.sort((a, b) => b._count - a._count).map((c) => <tr key={`${c.edgeType}${c.reviewStatus}`}><td>{c.edgeType}</td><td>{c.reviewStatus.toLowerCase()}</td><td className="text-right tabular-nums">{c._count}</td></tr>)}
        </tbody></table></TableWrap>
      </Card>
    </>
  )
}
