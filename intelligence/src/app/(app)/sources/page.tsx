import Link from 'next/link'
import { prisma } from '@/lib/db'
import { allowed, requireUser } from '@/lib/auth/next'
import { Badge, PageHeader, PermissionDenied, TableWrap } from '@/components/ui'

export const dynamic = 'force-dynamic'

export default async function Sources() {
  const s = await requireUser()
  if (!(await allowed(s, 'source:manage', '/sources'))) return <PermissionDenied permission="source:manage" />
  const rows = await prisma.source.findMany({ orderBy: [{ type: 'asc' }, { name: 'asc' }] })
  return (
    <>
      <PageHeader eyebrow="Source registry & data rights" title="Sources" subtitle="Publicly viewable does not mean freely redistributable. Every record in the platform cites one of these sources." />
      <TableWrap><table><thead><tr><th>Source</th><th>Type</th><th>Access</th><th>Rights (preliminary)</th><th>Terms review</th><th className="text-right">Records</th><th>Last import</th></tr></thead><tbody>
        {rows.map((r) => <tr key={r.id}><td><Link href={`/sources/${r.id}`}>{r.name}</Link><div className="text-xs text-ink-3">{r.owner}</div></td><td className="text-xs">{r.type.toLowerCase().replace(/_/g, ' ')}</td><td className="text-xs">{r.accessMethod} · {r.apiStatus?.toLowerCase().replace(/_/g, ' ')}</td><td><Badge tone={['PROHIBITED', 'RESTRICTED', 'UNKNOWN'].includes(r.rightsStatus) ? 'bad' : ['MANUAL_REVIEW_REQUIRED', 'LICENSE_REQUIRED', 'METADATA_ONLY', 'LINK_ONLY'].includes(r.rightsStatus) ? 'warn' : 'neutral'}>{r.rightsStatus.toLowerCase().replace(/_/g, ' ')}</Badge></td><td className="text-xs">{r.termsReviewStatus.toLowerCase().replace(/_/g, ' ')}</td><td className="text-right tabular-nums">{r.recordCount}</td><td className="text-xs">{r.lastSuccessfulImportAt?.toISOString().slice(0, 10) ?? '—'}</td></tr>)}
      </tbody></table></TableWrap>
    </>
  )
}
