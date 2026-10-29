import Link from 'next/link'
import type { Prisma, StudyType } from '@prisma/client'
import { prisma } from '@/lib/db'
import { allowed, requireUser } from '@/lib/auth/next'
import { can } from '@/lib/permissions'
import { LEVELS } from '@/lib/evidence-rubric'
import { Badge, LinkButton, PageHeader, Pagination, PermissionDenied, TableWrap, ReviewBadge, EntryModeBadge } from '@/components/ui'

export const dynamic = 'force-dynamic'

export default async function EvidencePage({ searchParams }: { searchParams: Promise<{ q?: string; type?: string; level?: string; page?: string }> }) {
  const s = await requireUser()
  if (!(await allowed(s, 'evidence:read', '/evidence'))) return <PermissionDenied permission="evidence:read" />
  const sp = await searchParams
  const page = Math.max(1, Number(sp.page ?? 1))
  const where: Prisma.EvidenceWhereInput = { ...(sp.q ? { OR: [{ title: { contains: sp.q, mode: 'insensitive' } }, { pmid: sp.q }, { doi: sp.q.toLowerCase() }] } : {}), ...(sp.type ? { studyType: sp.type as StudyType } : {}), ...(sp.level ? { evidenceLevel: { gte: Number(sp.level) } } : {}) }
  const [rows, total] = await Promise.all([prisma.evidence.findMany({ where, orderBy: [{ evidenceLevel: 'desc' }, { title: 'asc' }], skip: (page - 1) * 40, take: 40, include: { _count: { select: { links: true } } } }), prisma.evidence.count({ where })])
  return (
    <>
      <PageHeader eyebrow="Literature and other evidence" title="Evidence" subtitle={<>The evidence ladder organizes evidence <em>type</em>; it does not grade strength and does not authorize claims. Quality grades require a reviewer.</>} actions={can(s.principal, 'evidence:write') ? <LinkButton href="/evidence/new" variant="primary">Add evidence</LinkButton> : undefined} />
      <details className="mb-4 text-sm"><summary className="cursor-pointer text-ink-2">Evidence ladder</summary><ol className="mt-2 list-decimal pl-6 text-ink-2">{Object.entries(LEVELS).map(([k, v]) => <li key={k}>{v}</li>)}</ol></details>
      <form className="mb-4 flex flex-wrap gap-2"><input name="q" defaultValue={sp.q} placeholder="Title, PMID or DOI" className="max-w-sm" />
        <select name="type" defaultValue={sp.type ?? ''} className="w-auto"><option value="">Any study type</option>{['CONTROLLED_HUMAN', 'HUMAN_OBSERVATIONAL', 'EX_VIVO', 'IN_VITRO', 'ANIMAL', 'REVIEW', 'SYSTEMATIC_REVIEW', 'CASE_REPORT', 'REGULATORY_ASSESSMENT', 'OTHER'].map((t) => <option key={t} value={t}>{t.replace(/_/g, ' ').toLowerCase()}</option>)}</select>
        <select name="level" defaultValue={sp.level ?? ''} className="w-auto"><option value="">Any level</option>{[4, 5, 6, 7].map((l) => <option key={l} value={l}>Level {l}+</option>)}</select>
        <button className="rounded-full border border-line px-4 py-1.5 text-sm">Filter</button></form>
      <TableWrap><table><thead><tr><th>Title</th><th>Type</th><th>Level</th><th>Quality</th><th>Status</th></tr></thead><tbody>
        {rows.map((e) => <tr key={e.id}><td className="min-w-80"><Link href={`/evidence/${e.id}`}>{e.title}</Link><div className="text-xs text-ink-3">{e.pmid && `PMID ${e.pmid}`}{e.doi && ` · ${e.doi}`} · {e._count.links} links{e.medicalContext && ' · medical context'}{e.safetyRelevant && ' · safety-relevant'}</div></td>
          <td className="text-xs">{e.studyType.replace(/_/g, ' ').toLowerCase()}</td><td>{e.evidenceLevel ? <Badge tone="brand">L{e.evidenceLevel}</Badge> : '—'}</td><td className="text-xs">{e.qualityReviewerCategory.replace(/_/g, ' ').toLowerCase()}</td><td><EntryModeBadge mode={e.entryMode} /> <ReviewBadge status={e.reviewStatus} /></td></tr>)}
      </tbody></table></TableWrap>
      <Pagination page={page} pageSize={40} total={total} base={`/evidence?${new URLSearchParams(Object.entries(sp).filter(([k, v]) => v && k !== 'page') as [string, string][])}`} />
    </>
  )
}
