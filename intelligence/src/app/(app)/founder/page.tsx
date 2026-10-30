import { prisma } from '@/lib/db'
import { allowed, requireUser } from '@/lib/auth/next'
import { PageHeader, PermissionDenied } from '@/components/ui'
import { CATEGORY_OPTIONS, MARKET_OPTIONS, PREFERENCE_OPTIONS } from '../workbench/forms'
import { FounderWizard } from './FounderWizard'

export const dynamic = 'force-dynamic'

export default async function FounderPage() {
  const s = await requireUser()
  if (!(await allowed(s, 'research:write', '/founder'))) return <PermissionDenied permission="research:write" />
  const terms = await prisma.ontologyTerm.findMany({ where: { parentId: { not: null } }, orderBy: { label: 'asc' }, select: { code: true, label: true } })
  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader eyebrow="Founder workspace" title="Product Development Research Wizard" subtitle="Ten questions about your product. You will get a structured, evidence-linked research brief to take to a cosmetic chemist or manufacturer — not a finished formula." />
      <FounderWizard categories={CATEGORY_OPTIONS} preferences={PREFERENCE_OPTIONS} markets={MARKET_OPTIONS} concerns={terms.map((t) => [t.code, t.label] as const)} />
    </div>
  )
}
