import Link from 'next/link'
import { notFound } from 'next/navigation'
import { prisma } from '@/lib/db'
import { allowed, requireUser } from '@/lib/auth/next'
import { Badge, Card, DISCLAIMERS, EntryModeBadge, KeyValue, Notice, PageHeader, PermissionDenied, ReviewBadge } from '@/components/ui'

export const dynamic = 'force-dynamic'
const d = (x: Date | null) => x?.toISOString().slice(0, 10) ?? 'not retrieved'

export default async function PatentPage({ params }: { params: Promise<{ id: string }> }) {
  const s = await requireUser()
  if (!(await allowed(s, 'patent:read', '/patents/[id]'))) return <PermissionDenied permission="patent:read" />
  const { id } = await params
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound()
  const p = await prisma.patent.findUnique({ where: { id }, include: { links: { include: { ingredient: true } } } })
  if (!p) notFound()
  const src = await prisma.source.findUnique({ where: { id: p.sourceId } })
  return (
    <>
      <PageHeader eyebrow={`${p.jurisdiction} patent publication`} title={p.publicationNumber} subtitle={p.title} actions={<ReviewBadge status={p.reviewStatus} />} />
      <Notice kind="warn" title="Research aid — not a legal opinion">{DISCLAIMERS.patent}</Notice>
      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="Bibliographic data">
          <KeyValue items={[['Official record', <a key="o" href={p.officialUrl} target="_blank" rel="noreferrer">Espacenet (EPO)</a>], ['Discovery link', <a key="g" href={`https://patents.google.com/patent/${p.publicationNumber}/en`} target="_blank" rel="noreferrer">Google Patents</a>], ['Application number', p.applicationNumber ?? 'not retrieved'], ['Applicants', p.applicants.join(', ') || 'not retrieved'], ['Assignees', p.assignees.join(', ') || 'not retrieved'], ['Inventors', p.inventors.join(', ') || 'not retrieved'], ['Priority date', d(p.priorityDate)], ['Filing date', d(p.filingDate)], ['Publication date', d(p.publicationDate)], ['Grant date', d(p.grantDate)], ['CPC', p.cpcClassifications.join(', ') || 'not retrieved'], ['Legal status', p.legalStatus ?? 'not retrieved — do not infer'], ['Family members', p.familyMembers.join(', ') || 'not retrieved'], ['Source', src?.name], ['Last checked', d(p.lastCheckedAt)]]} />
        </Card>
        <Card title="Ingredient mentions (from title/snippet — unreviewed)">
          {p.links.length === 0 ? <p className="text-sm text-ink-3">None recorded.</p> : <ul className="space-y-1 text-sm">{p.links.map((l) => <li key={l.id}>{l.ingredient && <Link href={`/ingredients/${l.ingredientId}`}>{l.ingredient.displayName}</Link>} <Badge>{l.relation.replace(/_/g, ' ').toLowerCase()}</Badge> <EntryModeBadge mode={l.entryMode} /></li>)}</ul>}
          <div className="mt-3 text-xs text-ink-3">Topics: {p.topics.join(', ')}. Claims summary: {p.claimsSummary ?? 'not reviewed'}. A mention is not evidence of efficacy.</div>
        </Card>
      </div>
    </>
  )
}
