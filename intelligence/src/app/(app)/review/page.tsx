import Link from 'next/link'
import type { Prisma, ReviewType } from '@prisma/client'
import { prisma } from '@/lib/db'
import { allowed, requireUser } from '@/lib/auth/next'
import { can } from '@/lib/permissions'
import { eligibleReviewer } from '@/lib/services/review'
import { isStale } from '@/lib/regulatory'
import { Badge, Notice, PageHeader, PermissionDenied, TableWrap, Tabs, EmptyState } from '@/components/ui'
import { assignToMeAction, resolveQuarantineAction, unmergeAction } from './actions'
import { DecisionForm, IdentityForm } from './Forms'

export const dynamic = 'force-dynamic'
const OPEN: Prisma.ReviewTaskWhereInput['status'] = { in: ['SUBMITTED', 'ASSIGNED', 'UNDER_REVIEW', 'SECOND_REVIEW_REQUIRED', 'CHANGES_REQUESTED'] }
const ENTITY_HREF: Record<string, (id: string) => string> = { Ingredient: (id) => `/ingredients/${id}`, Evidence: (id) => `/evidence/${id}`, Source: (id) => `/sources/${id}`, Patent: (id) => `/patents/${id}` }

export default async function ReviewPage({ searchParams }: { searchParams: Promise<{ tab?: string; type?: string; mine?: string; queue?: string; page?: string }> }) {
  const s = await requireUser()
  if (!(await allowed(s, 'review:read', '/review'))) return <PermissionDenied permission="review:read" />
  const sp = await searchParams
  const tab = sp.tab ?? 'tasks'
  const counts = await Promise.all([
    prisma.reviewTask.count({ where: { status: OPEN } }),
    prisma.quarantineItem.count({ where: { status: 'OPEN' } }),
    prisma.identityResolutionCandidate.count({ where: { status: 'OPEN' } }),
    prisma.source.count({ where: { termsReviewStatus: { not: 'APPROVED' } } }),
  ])
  const regs = tab === 'stale' ? await prisma.regulatoryRecord.findMany({ where: { supersededAt: null }, include: { ingredient: true }, orderBy: [{ jurisdiction: 'asc' }] }) : []
  return (
    <>
      <PageHeader eyebrow="Human review is required before anything is approved" title="Review queue" subtitle="Reviews are routed to qualified roles. Reviewers cannot approve their own submissions; high-risk records require a second reviewer; disagreements go to adjudication." />
      <Tabs active={tab} base="/review" tabs={[{ key: 'tasks', label: 'Review tasks', count: counts[0] }, { key: 'quarantine', label: 'Quarantine', count: counts[1] }, { key: 'identity', label: 'Identity resolution', count: counts[2] }, { key: 'licensing', label: 'Licensing / data rights', count: counts[3] }, { key: 'stale', label: 'Stale regulatory' }]} />
      {tab === 'tasks' && <Tasks />}
      {tab === 'quarantine' && <Quarantine />}
      {tab === 'identity' && <Identity />}
      {tab === 'licensing' && <Licensing />}
      {tab === 'stale' && (
        <>
          <Notice kind="warn">Regulatory records never checked against their official source, or not re-checked within their stale window, must be re-verified by a regulatory reviewer.</Notice>
          <TableWrap><table><thead><tr><th>Ingredient</th><th>Jurisdiction</th><th>Status</th><th>Regulation</th><th>Last checked</th><th>Review</th></tr></thead><tbody>
            {regs.filter((r) => isStale(r)).map((r) => <tr key={r.id}><td><Link href={`/ingredients/${r.ingredientId}?tab=regulatory`}>{r.ingredient.displayName}</Link></td><td>{r.jurisdiction}</td><td className="text-xs">{r.status.toLowerCase()}</td><td className="text-xs">{r.regulationRef}</td><td><Badge tone="bad">{r.lastCheckedAt ? r.lastCheckedAt.toISOString().slice(0, 10) : 'never'}</Badge></td><td className="text-xs">{r.reviewStatus.toLowerCase()}</td></tr>)}
          </tbody></table></TableWrap>
        </>
      )}
    </>
  )

  async function Tasks() {
    const where: Prisma.ReviewTaskWhereInput = { status: OPEN, ...(sp.type ? { reviewType: sp.type as ReviewType } : {}), ...(sp.mine === '1' ? { OR: [{ assignedToId: s.user.id }, { requiredRoles: { hasSome: s.principal.roles } }] } : {}) }
    const page = Math.max(1, Number(sp.page ?? 1))
    const [tasks, byType] = await Promise.all([
      prisma.reviewTask.findMany({ where, orderBy: [{ priority: 'desc' }, { dueAt: 'asc' }], skip: (page - 1) * 50, take: 50, include: { decisions: true, assignedTo: true } }),
      prisma.reviewTask.groupBy({ by: ['reviewType'], where: { status: OPEN }, _count: true }),
    ])
    const now = Date.now()
    return (
      <>
        <form className="mb-3 flex flex-wrap gap-2 text-sm">
          <select name="type" defaultValue={sp.type ?? ''} className="w-auto"><option value="">All review types</option>{byType.map((b) => <option key={b.reviewType} value={b.reviewType}>{b.reviewType.toLowerCase().replace(/_/g, ' ')} ({b._count})</option>)}</select>
          <label className="inline-flex items-center gap-1"><input type="checkbox" name="mine" value="1" defaultChecked={sp.mine === '1'} /> For my roles / assigned to me</label>
          <input type="hidden" name="tab" value="tasks" /><button className="underline">Filter</button>
        </form>
        {tasks.length === 0 ? <EmptyState title="No open review tasks for this filter" /> : (
          <TableWrap><table><thead><tr><th>Task</th><th>Type</th><th>Required roles</th><th>Due</th><th>Decisions</th><th>Action</th></tr></thead><tbody>
            {tasks.map((t) => {
              const eligible = can(s.principal, 'review:act') && eligibleReviewer(s.principal.roles, t.requiredRoles)
              const mineDone = t.decisions.some((d) => d.reviewerId === s.user.id)
              const hideOthers = t.blind && !mineDone
              return (
                <tr key={t.id}>
                  <td className="min-w-64">{ENTITY_HREF[t.entityType] ? <Link href={ENTITY_HREF[t.entityType](t.entityId)}>{t.title}</Link> : t.title}<div className="text-xs text-ink-3">{t.entityType} · <Badge tone={t.priority === 'HIGH' || t.priority === 'URGENT' ? 'warn' : 'neutral'}>{t.priority.toLowerCase()}</Badge> {t.status === 'SECOND_REVIEW_REQUIRED' && <Badge tone="warn">second review / adjudication</Badge>}</div></td>
                  <td className="text-xs">{t.reviewType.toLowerCase().replace(/_/g, ' ')}</td>
                  <td className="text-xs">{t.requiredRoles.map((r) => r.toLowerCase().replace(/_/g, ' ')).join(', ')}</td>
                  <td>{t.dueAt && <Badge tone={t.dueAt.getTime() < now ? 'bad' : 'neutral'}>{t.dueAt.toISOString().slice(0, 10)}</Badge>}</td>
                  <td className="text-xs">{hideOthers ? `${t.decisions.length} hidden (blind review)` : t.decisions.map((d) => d.decision.toLowerCase()).join(', ') || '—'}{t.assignedTo && <div>assigned: {t.assignedTo.name}</div>}</td>
                  <td>{eligible && !mineDone ? <div className="space-y-1">{!t.assignedToId && <form action={assignToMeAction}><input type="hidden" name="taskId" value={t.id} /><button className="text-xs underline">Assign to me</button></form>}<DecisionForm taskId={t.id} /></div> : <span className="text-xs text-ink-3">{mineDone ? 'You decided' : 'Not your review type'}</span>}</td>
                </tr>
              )
            })}
          </tbody></table></TableWrap>
        )}
      </>
    )
  }

  async function Quarantine() {
    const items = await prisma.quarantineItem.findMany({ where: { status: 'OPEN', ...(sp.queue ? { queue: sp.queue as never } : {}) }, orderBy: { createdAt: 'desc' }, take: 200 })
    const byQueue = await prisma.quarantineItem.groupBy({ by: ['queue'], where: { status: 'OPEN' }, _count: true })
    return (
      <>
        <div className="mb-3 flex flex-wrap gap-2 text-sm">{byQueue.map((q) => <Link key={q.queue} href={`/review?tab=quarantine&queue=${q.queue}`}><Badge tone="warn">{q.queue.toLowerCase().replace(/_/g, ' ')} {q._count}</Badge></Link>)}</div>
        <TableWrap><table><thead><tr><th>Queue</th><th>Reason</th><th>Payload</th><th>Resolve</th></tr></thead><tbody>
          {items.map((q) => <tr key={q.id}><td className="text-xs">{q.queue.toLowerCase().replace(/_/g, ' ')}</td><td className="min-w-64 text-sm">{q.reason}{q.entityType === 'Ingredient' && q.entityId && <div><Link href={`/ingredients/${q.entityId}?tab=identity`} className="text-xs">open ingredient</Link></div>}</td><td><pre className="max-w-xs overflow-auto whitespace-pre-wrap text-xs text-ink-3">{JSON.stringify(q.payload)}</pre></td>
            <td>{can(s.principal, 'review:act') && <form action={resolveQuarantineAction} className="flex flex-wrap gap-1"><input type="hidden" name="id" value={q.id} /><input name="resolution" placeholder="Resolution" required className="w-40 py-1 text-xs" /><button name="status" value="RESOLVED" className="text-xs underline">Resolve</button><button name="status" value="DISMISSED" className="text-xs underline">Dismiss</button></form>}</td></tr>)}
        </tbody></table></TableWrap>
      </>
    )
  }

  async function Identity() {
    const [cands, merges] = await Promise.all([
      prisma.identityResolutionCandidate.findMany({ where: { status: 'OPEN' }, orderBy: [{ score: 'desc' }], take: 100 }),
      prisma.identityResolutionEvent.findMany({ where: { type: 'MERGE' }, orderBy: { createdAt: 'desc' }, take: 20 }),
    ])
    const ids = [...new Set(cands.flatMap((c) => [c.ingredientAId, c.ingredientBId]).concat(merges.flatMap((m) => [m.primaryIngredientId, m.secondaryIngredientId ?? ''])))]
    const ings = new Map((await prisma.ingredient.findMany({ where: { id: { in: ids } }, select: { id: true, displayName: true, canonicalName: true } })).map((i) => [i.id, i]))
    return (
      <>
        <Notice title="Never merge by similarity alone">Possible duplicates are proposed by name similarity and label ambiguity. Decide: same, related, salt/derivative, mixture containing, different, or unresolved. Every merge is reversible.</Notice>
        <TableWrap><table><thead><tr><th>Ingredient A</th><th>Ingredient B</th><th>Why proposed</th><th>Decision</th></tr></thead><tbody>
          {cands.map((c) => <tr key={c.id}><td><Link href={`/ingredients/${c.ingredientAId}`}>{ings.get(c.ingredientAId)?.canonicalName}</Link></td><td><Link href={`/ingredients/${c.ingredientBId}`}>{ings.get(c.ingredientBId)?.canonicalName}</Link></td><td className="text-xs">{c.reason}</td><td>{can(s.principal, 'ingredient:approve') || can(s.principal, 'ingredient:merge') ? <IdentityForm candidateId={c.id} /> : <span className="text-xs text-ink-3">Requires identity reviewer</span>}</td></tr>)}
        </tbody></table></TableWrap>
        <h2 className="mb-2 mt-6 text-lg">Merge history</h2>
        {merges.length === 0 ? <p className="text-sm text-ink-3">No merges performed.</p> : <ul className="space-y-2 text-sm">{merges.map((m) => <li key={m.id}>{ings.get(m.secondaryIngredientId ?? '')?.canonicalName} → {ings.get(m.primaryIngredientId)?.canonicalName} · {m.reason} · {m.createdAt.toISOString().slice(0, 10)} {m.reversedAt ? <Badge>reversed</Badge> : can(s.principal, 'ingredient:merge') && <form action={unmergeAction} className="inline"><input type="hidden" name="eventId" value={m.id} /><input type="hidden" name="reason" value="Reversed from review queue" /><button className="text-xs underline">Unmerge</button></form>}</li>)}</ul>}
      </>
    )
  }

  async function Licensing() {
    const sources = await prisma.source.findMany({ where: { termsReviewStatus: { not: 'APPROVED' } }, orderBy: { name: 'asc' } })
    return (
      <>
        <Notice kind="warn" title="Rights unclear ⇒ metadata and links only">Until a source’s terms are reviewed: no full-content copying, no external-API exposure, no export, no partner sharing and no model training. Approve the source-rights task in Review tasks (type: source rights).</Notice>
        <TableWrap><table><thead><tr><th>Source</th><th>Preliminary rights</th><th>Export</th><th>External API</th><th>Model training</th><th>Terms review</th></tr></thead><tbody>
          {sources.map((x) => <tr key={x.id}><td><Link href={`/sources/${x.id}`}>{x.name}</Link></td><td className="text-xs">{x.rightsStatus.toLowerCase().replace(/_/g, ' ')}</td>{[x.allowExport, x.allowExternalApi, x.allowModelTraining].map((v, i) => <td key={i}><Badge tone={v ? 'warn' : 'neutral'}>{v ? 'allowed' : 'blocked'}</Badge></td>)}<td className="text-xs">{x.termsReviewStatus.toLowerCase()}</td></tr>)}
        </tbody></table></TableWrap>
      </>
    )
  }
}
