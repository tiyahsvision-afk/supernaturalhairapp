import { allowed, requireUser } from '@/lib/auth/next'
import { PageHeader, PermissionDenied } from '@/components/ui'
import { NewEvidenceForm } from './Form'

export default async function NewEvidence() {
  const s = await requireUser()
  if (!(await allowed(s, 'evidence:write', '/evidence/new'))) return <PermissionDenied permission="evidence:write" />
  return (<><PageHeader eyebrow="Evidence" title="Add evidence record" subtitle="Record metadata and your extraction. Do not paste copyrighted full text. The record enters the evidence-review queue." /><NewEvidenceForm /></>)
}
