import { prisma } from '@/lib/db'
import { allowed, requireUser } from '@/lib/auth/next'
import { visibilityWhere } from '@/lib/permissions'
import { PageHeader, PermissionDenied, Notice } from '@/components/ui'
import { NewFormulaForm } from './Form'

export default async function NewFormula() {
  const s = await requireUser()
  if (!(await allowed(s, 'formula:write', '/formulas/new'))) return <PermissionDenied permission="formula:write" />
  const [ings, rms] = await Promise.all([
    prisma.ingredient.findMany({ where: { status: 'ACTIVE' }, select: { id: true, canonicalName: true, displayName: true }, orderBy: { displayName: 'asc' } }),
    prisma.rawMaterial.findMany({ where: visibilityWhere(s.principal, 'rawmaterial:read'), select: { id: true, tradeName: true } }),
  ])
  const options = [...ings.map((i) => ({ value: `ing:${i.id}`, label: i.displayName === i.canonicalName ? i.canonicalName : `${i.displayName} (${i.canonicalName})` })), ...rms.map((r) => ({ value: `rm:${r.id}`, label: `Raw material: ${r.tradeName}` }))]
  return (
    <>
      <PageHeader eyebrow="Formulas" title="New formula" subtitle="Created as CONCEPT, private to your organization (restricted). Percentages must total 100% (one q.s. line allowed)." />
      <Notice title="Candidate for cosmetic-chemist review">Nothing created here is safe to manufacture. Moving beyond concept requires a qualified chemist’s approval through the review queue; study use also requires safety approval.</Notice>
      <NewFormulaForm options={options} />
    </>
  )
}
