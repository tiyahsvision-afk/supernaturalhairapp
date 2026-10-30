import Link from 'next/link'
import { notFound } from 'next/navigation'
import { prisma } from '@/lib/db'
import { allowed, requireUser } from '@/lib/auth/next'
import { can, canViewRecord } from '@/lib/permissions'
import { signDownload } from '@/lib/storage'
import { Badge, Card, DISCLAIMERS, KeyValue, Notice, PageHeader, PermissionDenied, TableWrap, Button } from '@/components/ui'
import { addComponentAction, addSpecAction, verifySpecAction } from '../actions'
import { UploadForm } from './UploadForm'

export const dynamic = 'force-dynamic'

export default async function RawMaterialPage({ params }: { params: Promise<{ id: string }> }) {
  const s = await requireUser()
  if (!(await allowed(s, 'rawmaterial:read', '/raw-materials/[id]'))) return <PermissionDenied permission="rawmaterial:read" />
  const { id } = await params
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound()
  const rm = await prisma.rawMaterial.findUnique({ where: { id }, include: { supplier: true, components: { include: { ingredient: true } }, documents: { orderBy: { createdAt: 'desc' } }, specs: { orderBy: { parameter: 'asc' } } } })
  if (!rm || !canViewRecord(s.principal, rm, 'rawmaterial:read')) notFound()
  const now = Date.now()
  const canWrite = can(s.principal, 'rawmaterial:write')
  const ings = canWrite ? await prisma.ingredient.findMany({ where: { status: 'ACTIVE' }, select: { id: true, canonicalName: true }, orderBy: { canonicalName: 'asc' } }) : []
  return (
    <>
      <PageHeader eyebrow={`Raw material · ${rm.visibility.toLowerCase()}`} title={rm.tradeName} subtitle={rm.supplier?.name} actions={rm.isSample ? <Badge tone="warn">SAMPLE</Badge> : undefined} />
      <Notice>{DISCLAIMERS.supplier} It is not copied into the scientific-evidence section.</Notice>
      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="Supplier-provided details">
          <KeyValue items={[['Declared composition', rm.declaredComposition], ['Active %', rm.activePercent !== null ? `${Number(rm.activePercent)}%` : null], ['Active % confirmed', rm.activePercentConfirmed ? 'Yes (document-backed)' : 'No — active-level calculations are disabled'], ['Carrier', rm.carrier], ['Preservation system', rm.preservationSystem], ['Country of origin', rm.countryOfOrigin], ['MOQ', rm.moq], ['Lead time', rm.leadTime], ['Price range', rm.priceRange], ['Certifications', rm.certifications.join(', ')], ['Allergen statement', rm.allergenStatement], ['Internal approval', rm.internalApprovalStatus.toLowerCase()]]} />
        </Card>
        <Card title="Canonical ingredient components">
          <TableWrap><table><thead><tr><th>Ingredient</th><th>Range</th><th>Role</th><th>Confirmed</th></tr></thead><tbody>
            {rm.components.map((c) => <tr key={c.id}><td><Link href={`/ingredients/${c.ingredientId}`}>{c.ingredient.canonicalName}</Link></td><td className="tabular-nums">{c.percentMin !== null ? `${Number(c.percentMin)}–${Number(c.percentMax)}%` : 'not declared'}</td><td className="text-xs">{c.role.toLowerCase()}</td><td>{c.confirmed ? <Badge tone="good">yes</Badge> : <Badge>no</Badge>}</td></tr>)}
          </tbody></table></TableWrap>
          {canWrite && (
            <form action={addComponentAction} className="mt-3 grid gap-2 border-t border-line pt-3 sm:grid-cols-5">
              <input type="hidden" name="rawMaterialId" value={rm.id} />
              <input name="ingredientId" list="rm-ing" placeholder="ing:…" required className="sm:col-span-2" />
              <input name="min" placeholder="min %" inputMode="decimal" /><input name="max" placeholder="max %" inputMode="decimal" />
              <select name="role"><option>ACTIVE</option><option>CARRIER</option><option>PRESERVATIVE</option><option>SOLVENT</option><option>OTHER</option></select>
              <Button variant="secondary">Add component</Button>
              <datalist id="rm-ing">{ings.map((i) => <option key={i.id} value={`ing:${i.id}`}>{i.canonicalName}</option>)}</datalist>
            </form>
          )}
        </Card>
        <Card title="Documents (SDS, TDS, COA, specifications…)" className="lg:col-span-2">
          {rm.documents.length === 0 ? <p className="text-sm text-ink-3">No documents uploaded.</p> : (
            <TableWrap><table><thead><tr><th>Document</th><th>Type</th><th>Version / date</th><th>Expiry</th><th>Scan</th><th /></tr></thead><tbody>
              {rm.documents.map((d) => <tr key={d.id}><td>{d.title}<div className="mono text-xs text-ink-3">{d.sha256.slice(0, 12)}… · {(d.sizeBytes / 1024).toFixed(0)} KB</div></td><td>{d.docType}</td><td className="text-xs">{d.version ?? '—'} · {d.documentDate?.toISOString().slice(0, 10) ?? '—'}</td>
                <td>{d.expiresAt ? <Badge tone={d.expiresAt.getTime() < now ? 'bad' : d.expiresAt.getTime() < now + 60 * 86400_000 ? 'warn' : 'good'}>{d.expiresAt.toISOString().slice(0, 10)}</Badge> : '—'}</td>
                <td><Badge tone={d.scanStatus === 'CLEAN' ? 'good' : d.scanStatus === 'INFECTED' ? 'bad' : 'warn'}>{d.scanStatus.toLowerCase().replace('_', ' ')}</Badge></td>
                <td>{can(s.principal, 'document:read') && <a href={signDownload(d.id)}>Download</a>}</td></tr>)}
            </tbody></table></TableWrap>
          )}
          {can(s.principal, 'document:upload') && <UploadForm rawMaterialId={rm.id} />}
        </Card>
        <Card title="Specifications (from supplier documents)" className="lg:col-span-2">
          <p className="mb-3 text-xs text-ink-3">Enter values exactly as stated in the TDS, SDS, COA or specification sheet and link the document. A second person verifies each value against the document before it counts as verified.</p>
          {rm.specs.length > 0 && (
            <TableWrap><table><thead><tr><th>Parameter</th><th>Value</th><th>Method</th><th>Source document</th><th>Status</th></tr></thead><tbody>
              {rm.specs.map((sp) => <tr key={sp.id}><td>{sp.parameter}</td><td>{sp.value}{sp.unit ? ` ${sp.unit}` : ''}</td><td className="text-xs">{sp.method ?? '—'}</td><td className="text-xs">{rm.documents.find((d) => d.id === sp.documentId)?.title ?? <span className="text-ink-3">not linked</span>}</td>
                <td>{sp.verifiedAt ? <Badge tone="good">verified {sp.verifiedAt.toISOString().slice(0, 10)}</Badge> : can(s.principal, 'rawmaterial:write') && sp.createdById !== s.user.id && sp.documentId ? <form action={verifySpecAction}><input type="hidden" name="specId" value={sp.id} /><button className="rounded-full border border-line px-2 py-0.5 text-xs">Verify against document</button></form> : <Badge tone="warn">unverified</Badge>}</td></tr>)}
            </tbody></table></TableWrap>
          )}
          {can(s.principal, 'rawmaterial:write') && (
            <form action={addSpecAction} className="mt-3 grid gap-2 sm:grid-cols-6">
              <input type="hidden" name="rawMaterialId" value={rm.id} />
              <input name="parameter" placeholder="Parameter (e.g. Active content)" required className="sm:col-span-2" aria-label="Parameter" />
              <input name="value" placeholder="Value" required aria-label="Value" />
              <input name="unit" placeholder="Unit" aria-label="Unit" />
              <input name="method" placeholder="Method" aria-label="Method" />
              <select name="documentId" defaultValue="" aria-label="Source document"><option value="">Source document…</option>{rm.documents.map((d) => <option key={d.id} value={d.id}>{d.docType}: {d.title}</option>)}</select>
              <button className="rounded-full border border-line px-3 py-1.5 text-sm sm:col-span-6 sm:justify-self-start">Add value</button>
            </form>
          )}
        </Card>
      </div>
    </>
  )
}
