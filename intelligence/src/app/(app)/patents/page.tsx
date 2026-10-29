import Link from 'next/link'
import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/db'
import { allowed, requireUser } from '@/lib/auth/next'
import { Badge, DISCLAIMERS, Notice, PageHeader, PermissionDenied, TableWrap } from '@/components/ui'

export const dynamic = 'force-dynamic'

export default async function Patents({ searchParams }: { searchParams: Promise<{ q?: string; jur?: string; ingredient?: string; topic?: string }> }) {
  const s = await requireUser()
  if (!(await allowed(s, 'patent:read', '/patents'))) return <PermissionDenied permission="patent:read" />
  const sp = await searchParams
  const where: Prisma.PatentWhereInput = {
    ...(sp.q ? { OR: [{ title: { contains: sp.q, mode: 'insensitive' } }, { publicationNumber: { contains: sp.q.toUpperCase().replace(/[\s,]/g, '') } }, { assignees: { has: sp.q } }, { inventors: { has: sp.q } }, { cpcClassifications: { has: sp.q.toUpperCase() } }] } : {}),
    ...(sp.jur ? { jurisdiction: sp.jur } : {}),
    ...(sp.topic ? { topics: { has: sp.topic } } : {}),
    ...(sp.ingredient ? { links: { some: { ingredient: { OR: [{ displayName: { contains: sp.ingredient, mode: 'insensitive' } }, { canonicalName: { contains: sp.ingredient, mode: 'insensitive' } }, { aliases: { some: { alias: { contains: sp.ingredient, mode: 'insensitive' } } } }] } } } } : {}),
  }
  const [rows, jurs, topics] = await Promise.all([
    prisma.patent.findMany({ where, orderBy: { publicationNumber: 'asc' }, include: { links: { include: { ingredient: true } } } }),
    prisma.patent.groupBy({ by: ['jurisdiction'], _count: true }),
    prisma.$queryRaw<{ t: string }[]>`SELECT DISTINCT unnest(topics) AS t FROM "Patent" ORDER BY 1`,
  ])
  return (
    <>
      <PageHeader eyebrow="Patent landscape (metadata)" title="Patents" subtitle="Publication numbers link to official records (Espacenet). Assignees, dates, legal status and claims are not yet retrieved — Phase 2 connector." />
      <Notice kind="warn" title="Research aid — not a legal opinion">{DISCLAIMERS.patent}</Notice>
      <form className="mb-4 grid gap-2 sm:grid-cols-5">
        <input name="q" defaultValue={sp.q} placeholder="Title, number, assignee, inventor, CPC" className="sm:col-span-2" />
        <input name="ingredient" defaultValue={sp.ingredient} placeholder="Ingredient or synonym" />
        <select name="jur" defaultValue={sp.jur ?? ''}><option value="">Any jurisdiction</option>{jurs.map((j) => <option key={j.jurisdiction} value={j.jurisdiction}>{j.jurisdiction} ({j._count})</option>)}</select>
        <select name="topic" defaultValue={sp.topic ?? ''}><option value="">Any topic / function / format</option>{topics.map((t) => <option key={t.t}>{t.t}</option>)}</select>
        <button className="rounded-full border border-line px-4 py-1.5 text-sm">Search</button>
      </form>
      <TableWrap><table><thead><tr><th>Publication</th><th>Title</th><th>Jurisdiction</th><th>Mentioned ingredients (unreviewed)</th><th>Legal status</th></tr></thead><tbody>
        {rows.map((p) => <tr key={p.id}><td className="mono"><Link href={`/patents/${p.id}`}>{p.publicationNumber}</Link></td><td>{p.title}<div className="text-xs text-ink-3">{p.topics.join(' · ')}</div></td><td>{p.jurisdiction}</td><td className="text-xs">{p.links.map((l) => l.ingredient?.displayName).filter(Boolean).join(', ') || '—'}</td><td className="text-xs text-ink-3">{p.legalStatus ?? 'not retrieved'}</td></tr>)}
      </tbody></table></TableWrap>
      <p className="mt-2 text-xs text-ink-3">Search by chemical-structure identifier, date range and CPC requires bibliographic data from an official connector (Phase 2); fields exist and are searchable once populated.</p>
    </>
  )
}
