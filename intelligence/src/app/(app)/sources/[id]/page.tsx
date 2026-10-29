import { notFound } from 'next/navigation'
import { prisma } from '@/lib/db'
import { allowed, requireUser } from '@/lib/auth/next'
import { Card, KeyValue, PageHeader, PermissionDenied, Button, Field, Badge } from '@/components/ui'
import { updateSourceRightsAction } from '../actions'

export const dynamic = 'force-dynamic'
const RIGHTS = ['APPROVED_INTERNAL', 'APPROVED_COMMERCIAL', 'APPROVED_WITH_ATTRIBUTION', 'METADATA_ONLY', 'LINK_ONLY', 'MANUAL_REVIEW_REQUIRED', 'LICENSE_REQUIRED', 'RESTRICTED', 'PROHIBITED', 'UNKNOWN']

export default async function SourcePage({ params }: { params: Promise<{ id: string }> }) {
  const s = await requireUser()
  if (!(await allowed(s, 'ingredient:read', '/sources/[id]'))) return <PermissionDenied permission="ingredient:read" />
  const { id } = await params
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound()
  const x = await prisma.source.findUnique({ where: { id } })
  if (!x) notFound()
  const manage = await allowed(s, 'source:manage', 'source detail edit')
  const b = (v: boolean) => <Badge tone={v ? 'good' : 'neutral'}>{v ? 'yes' : 'no'}</Badge>
  return (
    <>
      <PageHeader eyebrow={x.type.toLowerCase().replace(/_/g, ' ')} title={x.name} subtitle={<>{x.owner} {x.url && <> · <a href={x.url} target="_blank" rel="noreferrer">{x.url}</a></>}</>} actions={<Badge tone="warn">{x.rightsStatus.toLowerCase().replace(/_/g, ' ')}</Badge>} />
      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="Data rights">
          <KeyValue items={[['License', x.license], ['Terms', x.termsUrl ? <a key="t" href={x.termsUrl} target="_blank" rel="noreferrer">{x.termsUrl}</a> : null], ['Commercial use', x.commercialUse], ['Internal use', x.internalUse], ['Redistribution', x.redistribution], ['Derivative works', x.derivativeWork], ['Attribution', x.attributionRequirements], ['Rate limits', x.rateLimits], ['Storage / caching / full text', <span key="sc">{b(x.storagePermission)} {b(x.cachingPermission)} {b(x.fullTextStoragePermission)}</span>], ['Document sharing', b(x.documentSharingPermission)], ['Export', b(x.allowExport)], ['External API', b(x.allowExternalApi)], ['Model training', b(x.allowModelTraining)], ['Partner sharing', b(x.allowPartnerSharing)], ['Approved uses', x.approvedUses.join('; ')], ['Prohibited uses', x.prohibitedUses.join('; ')]]} />
        </Card>
        <Card title="Operations">
          <KeyValue items={[['Access method', x.accessMethod], ['API status', x.apiStatus], ['Refresh frequency', x.refreshFrequency], ['Parser version', x.parserVersion], ['Last successful import', x.lastSuccessfulImportAt?.toISOString()], ['Last attempted import', x.lastAttemptedImportAt?.toISOString()], ['Records', x.recordCount], ['Errors', x.errorCount], ['Terms review', x.termsReviewStatus.toLowerCase()], ['Last terms review', x.lastTermsReviewAt?.toISOString().slice(0, 10)], ['Re-review due', x.reReviewDueAt?.toISOString().slice(0, 10)], ['Notes', x.reviewNotes]]} />
        </Card>
        {manage && (
          <Card title="Update rights (re-opens rights review)" className="lg:col-span-2">
            <form action={updateSourceRightsAction} className="grid gap-3 sm:grid-cols-3">
              <input type="hidden" name="id" value={x.id} />
              <Field label="Rights status"><select name="rightsStatus" defaultValue={x.rightsStatus}>{RIGHTS.map((r) => <option key={r} value={r}>{r.toLowerCase().replace(/_/g, ' ')}</option>)}</select></Field>
              <Field label="License"><input name="license" defaultValue={x.license ?? ''} /></Field>
              <Field label="Terms URL"><input name="termsUrl" defaultValue={x.termsUrl ?? ''} /></Field>
              <Field label="Commercial use"><input name="commercialUse" defaultValue={x.commercialUse ?? ''} /></Field>
              <Field label="Redistribution"><input name="redistribution" defaultValue={x.redistribution ?? ''} /></Field>
              <Field label="Attribution"><input name="attributionRequirements" defaultValue={x.attributionRequirements ?? ''} /></Field>
              <div className="flex flex-wrap gap-3 text-sm sm:col-span-3">{(['storagePermission', 'cachingPermission', 'fullTextStoragePermission', 'documentSharingPermission', 'allowExport', 'allowExternalApi', 'allowModelTraining', 'allowPartnerSharing'] as const).map((k) => <label key={k} className="inline-flex items-center gap-1"><input type="checkbox" name={k} defaultChecked={x[k]} />{k.replace(/([A-Z])/g, ' $1').toLowerCase()}</label>)}</div>
              <Field label="Re-review by"><input type="date" name="reReviewDueAt" /></Field>
              <Field label="Review notes"><input name="reviewNotes" defaultValue={x.reviewNotes ?? ''} /></Field>
              <Field label="Reason"><input name="reason" required /></Field>
              <div><Button>Save</Button></div>
            </form>
          </Card>
        )}
      </div>
    </>
  )
}
