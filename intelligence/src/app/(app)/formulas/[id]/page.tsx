import Link from 'next/link'
import { notFound } from 'next/navigation'
import { prisma } from '@/lib/db'
import { allowed, requireUser } from '@/lib/auth/next'
import { can, visibilityWhere } from '@/lib/permissions'
import { compare, getFormulaForPrincipal, summarizeVersion } from '@/lib/services/formulas'
import { Badge, Card, DISCLAIMERS, KeyValue, Notice, PageHeader, PermissionDenied, TableWrap, Button } from '@/components/ui'
import { duplicateAction } from '../actions'
import { StatusForm, VersionForm } from './Forms'

export const dynamic = 'force-dynamic'
const n = (v: unknown) => (v === null || v === undefined ? null : Number(v))
const label = (s: string) => s.replace(/_/g, ' ').toLowerCase()

export default async function FormulaPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ v?: string; compare?: string }> }) {
  const s = await requireUser()
  if (!(await allowed(s, 'formula:read', '/formulas/[id]'))) return <PermissionDenied permission="formula:read" />
  const { id } = await params
  const sp = await searchParams
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound()
  const f = await getFormulaForPrincipal(s.principal, id)
  if (!f) notFound() // also covers private formulas of other organizations: indistinguishable from not found
  const v = f.versions.find((x) => String(x.versionNumber) === sp.v) ?? f.versions[0]
  const summary = await summarizeVersion(v.id)
  const cmpTarget = sp.compare ? f.versions.find((x) => x.id === sp.compare) : null
  const cmp = cmpTarget ? await compare(cmpTarget.id, v.id) : null
  const canWrite = can(s.principal, 'formula:write')
  const [ings, rms] = canWrite ? await Promise.all([
    prisma.ingredient.findMany({ where: { status: 'ACTIVE' }, select: { id: true, canonicalName: true, displayName: true }, orderBy: { displayName: 'asc' } }),
    prisma.rawMaterial.findMany({ where: visibilityWhere(s.principal, 'rawmaterial:read'), select: { id: true, tradeName: true } }),
  ]) : [[], []]
  const options = [...ings.map((i) => ({ value: `ing:${i.id}`, label: i.displayName === i.canonicalName ? i.canonicalName : `${i.displayName} (${i.canonicalName})` })), ...rms.map((r) => ({ value: `rm:${r.id}`, label: `Raw material: ${r.tradeName}` }))]
  const initial = v.lines.map((l) => ({ ref: l.ingredientId ? `ing:${l.ingredientId}` : `rm:${l.rawMaterialId}`, pct: l.isQs ? 'qs' : String(n(l.percent) ?? ''), phase: l.phase ?? '', role: l.functionalRole ?? '' }))
  return (
    <>
      <PageHeader eyebrow={`${f.visibility.toLowerCase()} · ${f.productCategory ?? ''}`} title={`${f.code} — ${f.name}`}
        subtitle={<>Version {v.versionNumber} of {f.versions.length} · {label(v.status)} · chemist review: {label(v.chemistReviewStatus)} · safety review: {label(v.safetyReviewStatus)}</>}
        actions={<>{f.isSample && <Badge tone="warn">SAMPLE</Badge>}<Badge tone="brand">Candidate for cosmetic-chemist review</Badge></>} />
      {f.isSample && <Notice kind="warn">{DISCLAIMERS.sample}</Notice>}
      <div className="mb-4 flex flex-wrap gap-2 text-sm">
        {f.versions.map((x) => <Link key={x.id} href={`/formulas/${f.id}?v=${x.versionNumber}`} className={`rounded-full border px-3 py-1 no-underline ${x.id === v.id ? 'border-brand bg-brand-100' : 'border-line'}`}>v{x.versionNumber}{x.locked ? ' 🔒' : ''}</Link>)}
        {f.versions.length > 1 && f.versions.filter((x) => x.id !== v.id).map((x) => <Link key={`c${x.id}`} href={`/formulas/${f.id}?v=${v.versionNumber}&compare=${x.id}`} className="px-2 py-1 text-xs">compare with v{x.versionNumber}</Link>)}
      </div>
      {!summary.validation.valid && <Notice kind="danger" title="Formula does not validate">{summary.validation.errors.join(' ')}</Notice>}
      {summary.validation.warnings.length > 0 && <Notice kind="warn">{summary.validation.warnings.join(' ')}</Notice>}
      {cmp && (
        <Card title={`Compare v${cmpTarget!.versionNumber} → v${v.versionNumber}`} className="mb-4">
          <TableWrap><table><thead><tr><th>Ingredient / raw material</th><th>v{cmpTarget!.versionNumber}</th><th>v{v.versionNumber}</th><th>Change</th></tr></thead><tbody>
            {cmp.diff.map((d) => <tr key={d.key}><td>{d.displayName}</td><td className="tabular-nums">{d.beforeQs ? 'q.s.' : d.before ?? '—'}</td><td className="tabular-nums">{d.afterQs ? 'q.s.' : d.after ?? '—'}</td><td><Badge tone={d.status === 'SAME' ? 'neutral' : 'warn'}>{d.status.toLowerCase()}</Badge></td></tr>)}
          </tbody></table></TableWrap>
        </Card>
      )}
      <div className="grid gap-4 lg:grid-cols-3">
        <Card title="Composition" className="lg:col-span-2">
          <TableWrap><table><thead><tr><th>#</th><th>Material</th><th>Phase</th><th className="text-right">Use level</th><th className="text-right">Active level</th><th>Role</th></tr></thead><tbody>
            {v.lines.map((l, i) => { const a = summary.validation.activeLevels[i]; return (
              <tr key={l.id}><td className="text-xs text-ink-3">{l.additionOrder}</td>
                <td>{l.ingredient ? <Link href={`/ingredients/${l.ingredientId}`}>{l.displayName}</Link> : l.rawMaterial ? <Link href={`/raw-materials/${l.rawMaterialId}`}>{l.displayName}</Link> : l.displayName}{l.rawMaterial && <div className="text-xs text-ink-3">raw material (as supplied)</div>}</td>
                <td>{l.phase}</td><td className="text-right tabular-nums">{l.isQs ? `q.s. (${n(l.percent)}%)` : `${n(l.percent)}%`}</td>
                <td className="text-right text-xs tabular-nums">{l.rawMaterialId ? (a?.activePercent !== null && a ? `${a.activePercent}%` : <span title={a?.reason}>unknown</span>) : '—'}</td><td className="text-xs">{l.functionalRole}</td></tr>) })}
          </tbody></table></TableWrap>
          <div className="mt-2 text-xs text-ink-3">Explicit total {summary.validation.total}% {summary.validation.qsAmount !== null && `· q.s. ${summary.validation.qsAmount}%`} · phase totals: {Object.entries(summary.validation.phaseTotals).map(([p, t]) => `${p} ${t}%`).join(', ')}. Active levels are computed only when a raw material’s active % is confirmed.</div>
        </Card>
        <Card title="Version details">
          <KeyValue items={[['Application', label(v.applicationType)], ['Target pH', n(v.targetPh)], ['Intended goals', v.intendedGoals.join(', ')], ['Intended phenotypes', v.intendedPhenotypeCodes.join(', ')], ['Stability', label(v.stabilityStatus)], ['Study status', label(v.studyStatus)], ['Commercial', label(v.commercialStatus)], ['Locked', v.locked ? 'Yes — edits create a new version' : 'No'], ['Notes', v.notes]]} />
        </Card>
        <Card title="Regulatory flags">
          {summary.regulatory.length === 0 ? <p className="text-sm text-ink-3">No restricted/prohibited records on directly referenced ingredients. Absence of a record is not clearance.</p> : <ul className="space-y-2 text-sm">{summary.regulatory.map((r, i) => <li key={i}><Badge tone={r.status === 'PROHIBITED' ? 'bad' : 'warn'}>{r.jurisdiction} {label(r.status)}</Badge> {r.ingredient}{r.max && ` · max ${r.max}`}{r.exceeds === true && <Badge tone="bad">line exceeds max</Badge>}<div className="text-xs text-ink-3">{r.restriction} · record {label(r.reviewStatus)}</div></li>)}</ul>}
        </Card>
        <Card title="Allergens & compatibility">
          <div className="text-sm"><strong>Allergen summary:</strong> {summary.allergens.length ? summary.allergens.join(', ') : 'none recorded (fragrance mixtures may contain undeclared allergens)'}</div>
          <ul className="mt-2 space-y-1 text-sm">{summary.compatibility.length ? summary.compatibility.map((c, i) => <li key={i}><Badge tone="warn">{label(c.kind)}</Badge> {c.message}</li>) : <li className="text-ink-3">No recorded incompatibilities. Compatibility still requires chemist review.</li>}</ul>
        </Card>
        <Card title="Unresolved data & evidence">
          <ul className="mb-2 list-disc pl-5 text-xs text-ink-2">{summary.unresolved.slice(0, 12).map((u, i) => <li key={i}>{u}</li>)}{summary.unresolved.length > 12 && <li>…and {summary.unresolved.length - 12} more</li>}</ul>
          <div className="text-xs text-ink-3">Evidence: {summary.evidence.filter((e) => e.records).map((e) => `${e.ingredient} (${e.records}, max L${e.maxLevel}, ${e.reviewed} reviewed)`).join('; ') || 'none linked'}</div>
          <div className="mt-2 text-xs text-ink-3">Cost: {summary.cost.message}</div>
        </Card>
      </div>
      {canWrite && (
        <div className="mt-6 grid gap-4 lg:grid-cols-2">
          <Card title="Status"><StatusForm formulaId={f.id} versionId={v.id} current={v.status} /></Card>
          <Card title="Duplicate formula">
            <form action={duplicateAction} className="grid gap-2 sm:grid-cols-3"><input type="hidden" name="formulaId" value={f.id} /><input name="code" required placeholder="New code" /><input name="name" required placeholder="New name" /><Button variant="secondary">Duplicate latest version</Button></form>
          </Card>
          <Card title={`New version from v${v.versionNumber}`} className="lg:col-span-2"><VersionForm formulaId={f.id} fromVersionId={v.id} options={options} initial={initial} /></Card>
        </div>
      )}
    </>
  )
}
