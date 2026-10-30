import Link from 'next/link'
import { prisma } from '@/lib/db'
import { requireUser } from '@/lib/auth/next'
import { can, visibilityWhere } from '@/lib/permissions'
import { isStale } from '@/lib/regulatory'
import { projectListWhere, WORKFLOWS } from '@/lib/research/projects'
import { MODES, modeFor } from '@/lib/workspace'
import { Badge, Notice, ReviewBadge } from '@/components/ui'
import { setWorkspaceModeAction } from './home-actions'

export const dynamic = 'force-dynamic'

const ICON: Record<string, string> = { SUBSTITUTES: '⇄', FORMULATION: '⚗', CLAIM: '❝', SUPPLIERS: '▤', COMPARISON: '⊞', PRODUCT_BRIEF: '✦' }

export default async function Home() {
  const s = await requireUser()
  const user = await prisma.user.findUniqueOrThrow({ where: { id: s.user.id }, select: { name: true, workspaceMode: true, organization: { select: { type: true, name: true } } } })
  const mode = modeFor(user.workspaceMode, user.organization.type)
  const M = MODES[mode]
  const canResearch = can(s.principal, 'research:read')
  const since = new Date(Date.now() - 90 * 86400_000)

  // Ingredients this organization actually works with: lines of its visible formulas.
  const myLines = can(s.principal, 'formula:read') ? await prisma.formulaIngredient.findMany({ where: { ingredientId: { not: null }, formulaVersion: { formula: visibilityWhere(s.principal) } }, select: { ingredientId: true } }) : []
  const myIngredients = [...new Set(myLines.map((l) => l.ingredientId!))]
  const [projects, counts, sources, newEvidence, myRegs, myEvidence, approvals] = await Promise.all([
    canResearch ? prisma.researchProject.findMany({ where: projectListWhere(s.principal), orderBy: { updatedAt: 'desc' }, take: 5 }) : [],
    Promise.all([prisma.ingredient.count({ where: { status: 'ACTIVE' } }), prisma.evidence.count(), prisma.regulatoryRecord.count({ where: { supersededAt: null } }), prisma.product.count(), prisma.patent.count()]),
    prisma.source.findMany({ where: { lastSuccessfulImportAt: { not: null } }, orderBy: { lastSuccessfulImportAt: 'desc' }, take: 4, select: { name: true, lastSuccessfulImportAt: true, recordCount: true } }),
    prisma.evidence.findMany({ orderBy: { createdAt: 'desc' }, take: 3, select: { id: true, title: true, createdAt: true, reviewStatus: true } }),
    myIngredients.length ? prisma.regulatoryRecord.findMany({ where: { ingredientId: { in: myIngredients }, supersededAt: null }, select: { lastCheckedAt: true, staleAfterDays: true, status: true } }) : [],
    myIngredients.length ? prisma.evidenceLink.count({ where: { ingredientId: { in: myIngredients }, createdAt: { gte: since } } }) : 0,
    prisma.reviewDecision.count({ where: { decision: 'APPROVED', createdAt: { gte: since } } }),
  ])
  const [ingN, evN, regN, prodN, patN] = counts
  const staleMine = myRegs.filter((r) => isStale(r)).length
  const restrictedMine = myRegs.filter((r) => ['RESTRICTED', 'PROHIBITED', 'CONDITIONALLY_PERMITTED'].includes(r.status)).length

  return (
    <div className="space-y-8">
      <section className="rounded-3xl border border-line bg-gradient-to-br from-brand-100 via-paper to-paper p-6 sm:p-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="text-xs font-semibold uppercase tracking-widest text-brand-700">{M.label} workspace · {user.organization.name}</div>
            <h1 className="mt-1 text-3xl leading-tight text-ink sm:text-4xl">What do you need to find out?</h1>
            <p className="mt-2 max-w-2xl text-ink-2">{M.tagline}</p>
          </div>
          <form action={setWorkspaceModeAction} className="flex items-center gap-2 text-sm">
            <label htmlFor="mode" className="text-ink-3">View as</label>
            <select id="mode" name="mode" defaultValue={mode} className="w-auto">{Object.entries(MODES).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}</select>
            <button className="rounded-full border border-line bg-paper px-3 py-1 text-xs">Switch</button>
          </form>
        </div>
        <form action="/search" className="mt-6 flex gap-2">
          <input name="q" placeholder={`Search ${ingN.toLocaleString()} ingredients by INCI, synonym or CAS — or products, patents, evidence…`} aria-label="Search ingredient intelligence" className="flex-1 !rounded-full !py-3 !pl-5 text-base" />
          <button className="rounded-full border border-brand bg-brand px-5 text-sm font-semibold text-[#0d2440]">Search</button>
        </form>
        <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-sm">
          <Link href="/compare">Compare ingredients</Link>
          <Link href="/workbench/new?workflow=FORMULATION">Investigate a formulation</Link>
          <Link href="/evidence">Explore scientific evidence</Link>
          <Link href="/products/compare">Benchmark products</Link>
          <Link href="/assistant">Ask the research assistant</Link>
        </div>
      </section>

      {M.help && <Notice title="Getting started">{M.help}</Notice>}

      {canResearch && (
        <section>
          <div className="mb-3 flex items-end justify-between"><h2 className="text-xl text-ink">Start new research</h2><Link href="/workbench" className="text-sm">Research workbench →</Link></div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {M.start.map((w) => {
              const meta = WORKFLOWS[w as keyof typeof WORKFLOWS]
              return (
                <Link key={w} href={w === 'PRODUCT_BRIEF' ? '/founder' : `/workbench/new?workflow=${w}`} className="group rounded-2xl border border-line bg-paper p-5 no-underline transition hover:border-brand hover:shadow-sm">
                  <div className="mb-2 flex h-9 w-9 items-center justify-center rounded-xl bg-brand-100 text-lg text-brand-700" aria-hidden>{ICON[w]}</div>
                  <div className="font-serif text-lg text-ink group-hover:text-brand-700">{meta.label}</div>
                  <p className="mt-1 text-sm text-ink-2">{meta.blurb}</p>
                </Link>
              )
            })}
          </div>
        </section>
      )}

      <div className="grid gap-6 lg:grid-cols-[1fr_22rem]">
        <section>
          <div className="mb-3 flex items-end justify-between"><h2 className="text-xl text-ink">Saved research projects</h2>{canResearch && <Link href="/workbench" className="text-sm">All projects</Link>}</div>
          {projects.length ? (
            <ul className="divide-y divide-line rounded-2xl border border-line bg-paper">
              {projects.map((p) => (
                <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 p-4">
                  <div><Link href={`/workbench/${p.id}`} className="font-medium">{p.title}</Link><div className="text-xs text-ink-3">{WORKFLOWS[p.workflow].short} · updated {p.updatedAt.toISOString().slice(0, 10)}</div></div>
                  <div className="flex gap-1.5"><Badge>{p.status.toLowerCase().replace('_', ' ')}</Badge><ReviewBadge status={p.reviewStatus} /></div>
                </li>
              ))}
            </ul>
          ) : <p className="rounded-2xl border border-dashed border-line p-6 text-sm text-ink-3">No projects yet. Start one above — it is saved for your team with every source cited.</p>}

          {myIngredients.length > 0 && (
            <div className="mt-6 rounded-2xl border border-line bg-paper p-5">
              <h2 className="text-lg text-ink">Monitoring your ingredients</h2>
              <p className="mb-3 text-xs text-ink-3">{myIngredients.length} ingredients used in your organization’s formulas.</p>
              <ul className="space-y-2 text-sm">
                <li className="flex justify-between gap-2"><span>Regulatory records needing verification</span><Badge tone={staleMine ? 'warn' : 'good'}>{staleMine} of {myRegs.length}</Badge></li>
                <li className="flex justify-between gap-2"><span>Restricted or conditional records</span><Badge tone={restrictedMine ? 'warn' : 'neutral'}>{restrictedMine}</Badge></li>
                <li className="flex justify-between gap-2"><span>New evidence links (90 days)</span><Badge>{myEvidence}</Badge></li>
              </ul>
            </div>
          )}
        </section>

        <aside>
          <h2 className="mb-3 text-xl text-ink">Recent intelligence updates</h2>
          <div className="space-y-3 rounded-2xl border border-line bg-paper p-5 text-sm">
            <div className="grid grid-cols-2 gap-3">
              {[[ingN, 'ingredients', '/ingredients'], [evN, 'evidence records', '/evidence'], [regN, 'regulatory records', '/ingredients?jur=EU'], [prodN, 'products', '/products'], [patN, 'patents', '/patents']].map(([n, l, h]) => (
                <Link key={String(l)} href={String(h)} className="rounded-xl bg-paper-2 p-3 no-underline"><span className="block font-serif text-2xl text-ink tabular-nums">{Number(n).toLocaleString()}</span><span className="text-xs text-ink-3">{l}</span></Link>
              ))}
            </div>
            <ul className="space-y-2 border-t border-line pt-3">
              {sources.map((x) => <li key={x.name}><span className="text-ink">{x.name}</span><span className="block text-xs text-ink-3">refreshed {x.lastSuccessfulImportAt!.toISOString().slice(0, 10)} · {x.recordCount.toLocaleString()} records</span></li>)}
              {newEvidence.map((e) => <li key={e.id}><Link href={`/evidence/${e.id}`}>{e.title}</Link><span className="block text-xs text-ink-3">evidence added {e.createdAt.toISOString().slice(0, 10)} · {e.reviewStatus.toLowerCase()}</span></li>)}
              <li className="text-xs text-ink-3">{approvals} record(s) approved by qualified reviewers in the last 90 days.</li>
            </ul>
          </div>
        </aside>
      </div>
      <p className="text-xs text-ink-3">Research and decision support. Records show whether they are verified, source-reported, rule-derived, hypotheses or missing. Nothing here is a finished formulation, safety assessment or regulatory approval.</p>
    </div>
  )
}
