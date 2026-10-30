import Link from 'next/link'
import type { ResearchWorkflow } from '@prisma/client'
import { prisma } from '@/lib/db'
import { allowed, requireUser } from '@/lib/auth/next'
import { visibilityWhere } from '@/lib/permissions'
import { WORKFLOWS } from '@/lib/research/projects'
import { PageHeader, PermissionDenied, Notice } from '@/components/ui'
import { WorkflowForm } from '../forms'

export const dynamic = 'force-dynamic'

export default async function NewResearchPage({ searchParams }: { searchParams: Promise<{ workflow?: string; ingredient?: string; ids?: string }> }) {
  const s = await requireUser()
  if (!(await allowed(s, 'research:write', '/workbench/new'))) return <PermissionDenied permission="research:write" />
  const sp = await searchParams
  const workflow = (sp.workflow && sp.workflow in WORKFLOWS ? sp.workflow : 'SUBSTITUTES') as ResearchWorkflow
  if (workflow === 'PRODUCT_BRIEF') return <Notice title="Use the founder wizard"><Link href="/founder">Open the Product Development Research Wizard</Link></Notice>
  const ids = [...(sp.ingredient ? [sp.ingredient] : []), ...(sp.ids ?? '').split(',')].filter((x) => /^[0-9a-f-]{36}$/.test(x)).slice(0, 6)
  const [initial, formulas, rawMaterials, fns] = await Promise.all([
    prisma.ingredient.findMany({ where: { id: { in: ids } }, select: { id: true, displayName: true, inciName: true } }),
    workflow === 'FORMULATION' ? prisma.formula.findMany({ where: visibilityWhere(s.principal), orderBy: { code: 'asc' }, select: { id: true, code: true, name: true, isSample: true } }) : [],
    workflow === 'SUPPLIERS' ? prisma.rawMaterial.findMany({ where: visibilityWhere(s.principal, 'rawmaterial:read'), orderBy: { tradeName: 'asc' }, select: { id: true, tradeName: true, isSample: true } }) : [],
    workflow === 'SUBSTITUTES' ? prisma.$queryRaw<{ fn: string }[]>`SELECT DISTINCT unnest("cosingFunctions") AS fn FROM "Ingredient" ORDER BY 1` : [],
  ])
  const meta = WORKFLOWS[workflow]
  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader eyebrow="Research workbench" title={meta.label} subtitle={meta.blurb} />
      <div className="mb-4 flex flex-wrap gap-1.5 text-sm">{(['SUBSTITUTES', 'FORMULATION', 'CLAIM', 'SUPPLIERS', 'COMPARISON', 'GENERAL'] as ResearchWorkflow[]).map((w) => <Link key={w} href={`/workbench/new?workflow=${w}`} className={`rounded-full border px-3 py-1 ${w === workflow ? 'border-brand bg-brand-100 text-brand-700' : 'border-line text-ink-2'}`}>{WORKFLOWS[w].short}</Link>)}</div>
      <section className="rounded-2xl border border-line bg-paper p-5 sm:p-6">
        <WorkflowForm workflow={workflow} initial={initial.map((i) => ({ id: i.id, label: i.displayName, detail: i.inciName }))} formulas={formulas.map((f) => ({ id: f.id, label: `${f.code} — ${f.name}${f.isSample ? ' (sample)' : ''}` }))} rawMaterials={rawMaterials.map((r) => ({ id: r.id, label: `${r.tradeName}${r.isSample ? ' (sample)' : ''}` }))} cosingFunctions={fns.map((f) => f.fn)} />
      </section>
      <p className="mt-3 text-xs text-ink-3">Results are saved as a project in your organization’s workspace. Research decision support only — not a formulation, safety assessment, regulatory approval or legal advice.</p>
    </div>
  )
}
