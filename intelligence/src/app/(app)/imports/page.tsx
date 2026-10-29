import Link from 'next/link'
import { prisma } from '@/lib/db'
import { allowed, requireUser } from '@/lib/auth/next'
import { Badge, Card, PageHeader, PermissionDenied, TableWrap, Tabs } from '@/components/ui'
import { UploadForm } from './UploadForm'

export const dynamic = 'force-dynamic'
const TEMPLATES: Record<string, string> = {
  ingredient: 'external_id,canonical_name,inci_name,common_name,identity_type,material_type,origin_type,family,functions,aliases,cas,pubchem_cid,description,priority_tier',
  product: 'slug,brand,name,category,application_type,is_supernatural,barcode,source_url,ingredient_list,ingredient_list_source,valid_from',
  evidence: 'title,pmid,doi,pmcid,study_type,evidence_level,source_url,ingredients,outcomes,direction,textured_hair,limitations',
  patent: 'publication_number,title,official_url,assignees,inventors,cpc,legal_status,topics,ingredients',
  regulatory: 'ingredient,jurisdiction,authority,regulation_ref,status,max_concentration,max_concentration_unit,product_restrictions,warning_requirements,labeling_requirements,effective_date,source_url,last_checked_at,notes',
  fact: 'ingredient,property_type,value,unit,source_location,test_conditions,medium,confidence,external_id',
}

export default async function Imports({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const s = await requireUser()
  if (!(await allowed(s, 'import:run', '/imports'))) return <PermissionDenied permission="import:run" />
  const { tab = 'jobs' } = await searchParams
  const [jobs, sources, queue] = await Promise.all([
    prisma.importJob.findMany({ orderBy: { createdAt: 'desc' }, take: 50 }),
    prisma.source.findMany({ where: { active: true }, orderBy: { name: 'asc' } }),
    tab === 'queue' ? prisma.ingestionQueueItem.findMany({ orderBy: [{ priorityTier: 'asc' }, { label: 'asc' }], take: 300 }) : Promise.resolve([]),
  ])
  const sourceName = new Map(sources.map((x) => [x.id, x.name]))
  return (
    <>
      <PageHeader eyebrow="Extract → validate → normalize → resolve identity → detect duplicates → store → propose → review" title="Imports" subtitle="Imports run in the background, are idempotent (re-running yields 'unchanged'), and resume from the last committed row after a failure." />
      <Tabs active={tab} base="/imports" tabs={[{ key: 'jobs', label: 'Jobs', count: jobs.length }, { key: 'queue', label: 'Prioritized ingestion queue' }, { key: 'templates', label: 'CSV templates' }]} />
      {tab === 'jobs' && (
        <>
          <Card title="New import" className="mb-4"><UploadForm sources={sources.map((x) => ({ id: x.id, name: x.name, rights: x.rightsStatus }))} /></Card>
          <TableWrap><table><thead><tr><th>Job</th><th>Entity</th><th>Source</th><th>Status</th><th className="text-right">Created</th><th className="text-right">Updated</th><th className="text-right">Unchanged</th><th className="text-right">Duplicates</th><th className="text-right">Rejected</th><th className="text-right">Unresolved</th><th className="text-right">Warnings</th></tr></thead><tbody>
            {jobs.map((j) => <tr key={j.id}><td><Link href={`/imports/${j.id}`} className="mono text-xs">{j.id.slice(0, 8)}</Link><div className="text-xs text-ink-3">{j.filename} · {j.createdAt.toISOString().slice(0, 16).replace('T', ' ')}</div></td><td>{j.entityType}</td><td className="text-xs">{sourceName.get(j.sourceId)}</td><td><Badge tone={j.status === 'COMPLETED' ? 'good' : j.status === 'FAILED' ? 'bad' : 'warn'}>{j.status.toLowerCase()}</Badge></td>
              {[j.createdCount, j.updatedCount, j.unchangedCount, j.duplicateCount, j.rejectedCount, j.unresolvedCount, j.warningCount].map((c, i) => <td key={i} className="text-right tabular-nums">{c}</td>)}</tr>)}
          </tbody></table></TableWrap>
        </>
      )}
      {tab === 'queue' && (
        <TableWrap><table><thead><tr><th>Ingredient</th><th>Tier</th><th>Reason</th><th>Supernatural products</th><th className="text-right">Hair Passport appearances</th><th className="text-right">Textured products</th><th>Evidence</th><th>Regulatory priority</th><th>Import status</th><th>Review</th></tr></thead><tbody>
          {queue.map((q) => <tr key={q.id}><td>{q.ingredientId ? <Link href={`/ingredients/${q.ingredientId}`}>{q.label}</Link> : q.label}</td><td><Badge>{q.priorityTier}</Badge></td><td className="text-xs">{q.reason}</td><td className="text-xs">{q.supernaturalProducts.join(', ')}</td><td className="text-right">{q.hairPassportAppearances}</td><td className="text-right">{q.texturedProductAppearances}</td><td className="text-xs">{q.evidenceAvailability.toLowerCase()}</td><td className="text-xs">{q.regulatoryReviewPriority.toLowerCase()}</td><td className="text-xs">{q.importStatus.toLowerCase().replace(/_/g, ' ')}</td><td className="text-xs">{q.reviewStatus.toLowerCase()}</td></tr>)}
        </tbody></table></TableWrap>
      )}
      {tab === 'templates' && (
        <div className="space-y-3">{Object.entries(TEMPLATES).map(([k, v]) => <Card key={k} title={k}><code className="block break-all text-xs">{v}</code><p className="mt-2 text-xs text-ink-3">List fields (functions, aliases, ingredients, outcomes, topics) are separated with “;”. JSON imports accept an array of objects with the same keys.</p></Card>)}</div>
      )}
    </>
  )
}
