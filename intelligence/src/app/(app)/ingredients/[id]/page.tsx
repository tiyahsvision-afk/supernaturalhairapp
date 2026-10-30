import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { prisma } from '@/lib/db'
import { allowed, requireUser } from '@/lib/auth/next'
import { can, canViewRecord } from '@/lib/permissions'
import { ingredientDetail } from '@/lib/services/ingredients'
import { postgresGraphStore } from '@/lib/services/graph'
import { isStale, JURISDICTIONS, REGULATORY_DISCLAIMER } from '@/lib/regulatory'
import { GraphSvg } from '@/components/GraphSvg'
import { DerivedChips, DimensionTable, StatusLegend } from '@/components/intel'
import { dimensionsFor, loadIntel } from '@/lib/dimensions'
import { Badge, Card, DISCLAIMERS, EmptyState, EntryModeBadge, KeyValue, LinkButton, Notice, PageHeader, PermissionDenied, Provenance, ReviewBadge, TableWrap, Tabs, Button, Field } from '@/components/ui'
import { addAliasAction, addConcentrationAction, addFactAction, addFunctionAction, addIdentifierAction, addRegulatoryAction, updateIngredientAction } from '../actions'

export const dynamic = 'force-dynamic'

const fmt = (d?: Date | null) => (d ? d.toISOString().slice(0, 10) : '—')
const num = (v: unknown) => (v === null || v === undefined ? null : Number(v))
const label = (s: string) => s.replace(/_/g, ' ').toLowerCase()
const PROPERTY_TYPES = ['MOLECULAR_WEIGHT', 'SOLUBILITY', 'PARTITION_COEFFICIENT', 'MELTING_POINT', 'BOILING_POINT', 'DENSITY', 'VISCOSITY', 'CHARGE', 'PKA', 'HLB', 'CRITICAL_MICELLE_CONCENTRATION', 'PH_RANGE', 'PROCESSING_TEMPERATURE', 'STABILITY_RANGE', 'LIGHT_SENSITIVITY', 'OXIDATION_SENSITIVITY', 'HYDROLYSIS_SENSITIVITY', 'STORAGE_REQUIREMENTS', 'INCOMPATIBILITIES', 'DEGRADATION_PATHWAYS', 'HUMECTANT_BEHAVIOR', 'CONDITIONING_BEHAVIOR', 'FILM_FORMING_BEHAVIOR', 'KERATIN_INTERACTION', 'SCALP_INTERACTION', 'ALLERGEN_INFORMATION', 'SENSITIZATION_INFORMATION', 'IRRITATION_INFORMATION', 'SUPPLIER_RECOMMENDATION', 'OTHER']

export default async function IngredientPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ tab?: string }> }) {
  const s = await requireUser()
  if (!(await allowed(s, 'ingredient:read', '/ingredients/[id]'))) return <PermissionDenied permission="ingredient:read" />
  const { id } = await params
  const { tab = 'overview' } = await searchParams
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound()
  const d = await ingredientDetail(id)
  if (!d) notFound()
  const { ing, sources, completeness, conflicts, staleRegulatory } = d
  if (ing.status === 'MERGED' && ing.mergedIntoId) redirect(`/ingredients/${ing.mergedIntoId}?mergedFrom=${ing.id}`)
  const src = (sid?: string | null) => (sid ? sources.get(sid) : null)
  const canWrite = can(s.principal, 'ingredient:write')
  const currentFacts = ing.facts.filter((f) => !f.supersededAt)
  const currentReg = ing.regulatory.filter((r) => !r.supersededAt)
  const visibleFormulaLines = ing.formulaLines.filter((l) => can(s.principal, 'formula:read') && canViewRecord(s.principal, l.formulaVersion.formula))
  const currentProducts = ing.productLines.filter((l) => !l.productVersion.validTo)
  const tabs = [
    { key: 'overview', label: 'Overview' }, { key: 'identity', label: 'Identity', count: ing.identifiers.length + ing.aliases.length },
    { key: 'properties', label: 'Properties', count: currentFacts.length }, { key: 'functions', label: 'Functions', count: ing.functions.length },
    { key: 'concentrations', label: 'Concentrations', count: ing.concentrations.length }, { key: 'compatibility', label: 'Compatibility' },
    { key: 'safety', label: 'Safety', count: ing.safetyReviews.length }, { key: 'regulatory', label: 'Regulatory', count: currentReg.length },
    { key: 'evidence', label: 'Evidence', count: ing.evidenceLinks.filter((l) => l.role !== 'OUTCOME').length }, { key: 'patents', label: 'Patents', count: ing.patentLinks.length },
    { key: 'suppliers', label: 'Suppliers', count: ing.rawComponents.length }, { key: 'products', label: 'Products', count: currentProducts.length },
    { key: 'formulas', label: 'Formulas', count: visibleFormulaLines.length }, { key: 'phenotypes', label: 'Phenotypes' }, { key: 'outcomes', label: 'Outcomes' },
    { key: 'graph', label: 'Graph', count: d.edgeCount }, { key: 'history', label: 'History' },
  ]
  const intel = tab === 'overview' ? (await loadIntel(s.principal, [ing.id])).map(dimensionsFor)[0] : null
  const allSources = tab === 'properties' || tab === 'regulatory' || tab === 'concentrations' || tab === 'functions' || tab === 'identity' ? await prisma.source.findMany({ where: { active: true }, orderBy: { name: 'asc' } }) : []
  return (
    <>
      <PageHeader eyebrow={`${label(ing.identityType)} · ${ing.family?.name ?? 'no family'}`} title={ing.displayName}
        subtitle={<>{ing.inciName && <>INCI: <strong>{ing.inciName}</strong> · </>}Priority tier {ing.priorityTier ?? '—'}{ing.priorityReason && <> — {ing.priorityReason}</>}</>}
        actions={<><ReviewBadge status={ing.reviewStatus} /><Badge tone="brand">Completeness {completeness.score}%</Badge><LinkButton href={`/compare?ids=${ing.id}`}>Compare</LinkButton><LinkButton href={`/workbench/new?workflow=SUBSTITUTES&ingredient=${ing.id}`} variant="primary">Find substitutes</LinkButton></>} />
      {ing.identityNote && <Notice kind="warn" title="Identity note">{ing.identityNote}</Notice>}
      <Tabs tabs={tabs} active={tab} base={`/ingredients/${ing.id}`} />

      {tab === 'overview' && (
        <div className="grid gap-4 lg:grid-cols-3">
          {intel && (
            <Card title="Technical profile" className="lg:col-span-2" actions={<span className="text-xs text-ink-3">No value is shown without a source</span>}>
              <div className="mb-4"><StatusLegend /></div>
              <DimensionTable dims={intel.dims} />
            </Card>
          )}
          <div className="space-y-4">
            <Card title="Rule-based classification">
              <DerivedChips classes={intel?.derived ?? []} />
              <p className="mt-3 text-xs text-ink-3">Computed from the INCI name and official CosIng functions by transparent rules. Hover a tag for the rule. Screening aids, not measurements; naming rules have exceptions.</p>
            </Card>
            {(ing.cosingRef || ing.cosingFunctions.length > 0) && (
              <Card title="EU CosIng record">
                <KeyValue items={[
                  ['CosIng ref', ing.cosingRef ?? 'not listed'],
                  ['Functions', ing.cosingFunctions.join(', ') || '—'],
                  ['Description', ing.cosingDescription],
                  ['Annex reference', ing.cosingRestriction ?? 'none listed'],
                  ['CosIng update', ing.cosingUpdated],
                ]} />
                <p className="mt-3 text-xs text-ink-3">Source: European Commission CosIng database (via Open Beauty Facts). CosIng is an information database without legal value; an Annex reference must be checked against the consolidated regulation.</p>
              </Card>
            )}
          </div>
          <Card title="Identity" className="lg:col-span-2">
            <KeyValue items={[
              ['Canonical name', ing.canonicalName], ['Display name', ing.displayName], ['Common name', ing.commonName], ['Chemical name', ing.chemicalName],
              ['Identity type', label(ing.identityType)], ['Material type', label(ing.materialType)], ['Origin', label(ing.originType)],
              ['Botanical source', ing.complexProfile?.botanicalSource ? <em>{ing.complexProfile.botanicalSource.genus} {ing.complexProfile.botanicalSource.species}</em> : null],
              ['Plant part', ing.complexProfile?.plantPart], ['Description', ing.description], ['Record version', `v${ing.version} · updated ${fmt(ing.updatedAt)}`],
            ]} />
          </Card>
          <Card title="Completeness">
            <ul className="space-y-1 text-sm">{completeness.items.filter((i) => i.applicable).map((i) => <li key={i.key} className="flex justify-between gap-2"><span className="text-ink-2">{i.label}</span>{i.present ? <Badge tone="good">present</Badge> : <Badge>missing</Badge>}</li>)}</ul>
            <p className="mt-3 text-xs text-ink-3">{DISCLAIMERS.completeness}</p>
          </Card>
          {conflicts.some((c) => c.conflict) && <div className="lg:col-span-3"><Notice kind="warn" title="Sources disagree">{conflicts.filter((c) => c.conflict).map((c) => label(c.propertyType)).join(', ')} — see Properties for side-by-side values.</Notice></div>}
          {staleRegulatory.length > 0 && <div className="lg:col-span-3"><Notice kind="warn" title={`${staleRegulatory.length} regulatory record(s) are stale or never checked against their source`}>Regulatory records must be re-verified by a regulatory reviewer before use.</Notice></div>}
          {canWrite && (
            <Card title="Edit identity fields" className="lg:col-span-3">
              <form action={updateIngredientAction} className="grid gap-3 sm:grid-cols-2">
                <input type="hidden" name="id" value={ing.id} />
                <Field label="Display name"><input name="displayName" defaultValue={ing.displayName} /></Field>
                <Field label="Common name"><input name="commonName" defaultValue={ing.commonName ?? ''} /></Field>
                <Field label="Chemical name"><input name="chemicalName" defaultValue={ing.chemicalName ?? ''} /></Field>
                <Field label="Identity note"><input name="identityNote" defaultValue={ing.identityNote ?? ''} /></Field>
                <div className="sm:col-span-2"><Field label="Description"><textarea name="description" rows={2} defaultValue={ing.description ?? ''} /></Field></div>
                <div className="sm:col-span-2"><Field label="Reason for change (required, recorded in history)"><input name="reason" required /></Field></div>
                <div><Button>Save as new version (requires re-review)</Button></div>
              </form>
            </Card>
          )}
        </div>
      )}

      {tab === 'identity' && (
        <div className="grid gap-4 lg:grid-cols-2">
          <Card title="Identifiers">
            {ing.identifiers.length === 0 ? <EmptyState title="No identifiers">{['DEFINED_SUBSTANCE', 'SALT', 'ESTER', 'ISOMER', 'DERIVATIVE'].includes(ing.identityType) ? 'Identifiers apply to this identity type; add one with its source.' : 'Single-structure identifiers may not apply to this complex material.'}</EmptyState> : (
              <ul className="space-y-3 text-sm">{ing.identifiers.map((i) => (
                <li key={i.id} className={i.supersededAt ? 'opacity-50' : ''}>
                  <div className="flex flex-wrap items-center gap-2"><Badge>{i.type.replace('_', ' ')}</Badge><code className="break-all">{i.value}</code>
                    <Badge tone={i.verificationStatus === 'VERIFIED' ? 'good' : i.verificationStatus === 'CONFLICT' || i.verificationStatus === 'REJECTED' ? 'bad' : 'warn'}>{label(i.verificationStatus)}</Badge>
                    {i.isRepresentative && <Badge title="Identifier of a representative structure, not the full mixture identity">representative structure</Badge>}</div>
                  <Provenance source={src(i.sourceId)} location={i.sourceLocation} />
                </li>))}</ul>
            )}
            {canWrite && (
              <form action={addIdentifierAction} className="mt-4 grid gap-2 border-t border-line pt-4 sm:grid-cols-3">
                <input type="hidden" name="id" value={ing.id} />
                <select name="type">{['CAS', 'EC', 'PUBCHEM_CID', 'DTXSID', 'INCHIKEY', 'COSING_REF', 'UNII'].map((t) => <option key={t}>{t}</option>)}</select>
                <input name="value" placeholder="Value" required />
                <select name="sourceKey">{allSources.map((x) => <option key={x.key} value={x.key}>{x.name}</option>)}</select>
                <input name="sourceLocation" placeholder="Source location (URL, page, record id)" className="sm:col-span-2" />
                <Button variant="secondary">Add (unverified)</Button>
              </form>
            )}
            <p className="mt-3 text-xs text-ink-3">CAS and EC numbers are checksum-validated. An identifier already attached to another ingredient is stored as a conflict and quarantined — records are never merged automatically.</p>
          </Card>
          <Card title="Names and aliases">
            <ul className="space-y-1 text-sm">
              {ing.names.map((n) => <li key={n.id} className="flex flex-wrap gap-2"><Badge tone="brand">{n.nameType}</Badge>{n.name}{n.isPreferred && <Badge>preferred</Badge>}</li>)}
              {ing.aliases.map((a) => <li key={a.id} className="flex flex-wrap gap-2"><Badge tone={a.aliasType === 'MISSPELLING' || a.aliasType === 'LABEL_DISPLAY_NAME' ? 'warn' : 'neutral'}>{label(a.aliasType)}</Badge>{a.alias}</li>)}
            </ul>
            {canWrite && (
              <form action={addAliasAction} className="mt-4 flex flex-wrap gap-2 border-t border-line pt-4">
                <input type="hidden" name="id" value={ing.id} />
                <input name="alias" placeholder="New alias" required className="max-w-xs" />
                <select name="aliasType" className="max-w-xs">{['SYNONYM', 'ABBREVIATION', 'TRADE_NAME', 'LABEL_DISPLAY_NAME', 'MISSPELLING', 'LEGACY_NAME'].map((t) => <option key={t} value={t}>{label(t)}</option>)}</select>
                <Button variant="secondary">Add alias</Button>
              </form>
            )}
          </Card>
          <Card title="Related forms (not interchangeable without review)" className="lg:col-span-2">
            {ing.relationsFrom.length + ing.relationsTo.length === 0 ? <p className="text-sm text-ink-3">No recorded relationships.</p> : (
              <ul className="space-y-1 text-sm">
                {ing.relationsFrom.map((r) => <li key={r.id}>This is <strong>{label(r.relationType)}</strong> <Link href={`/ingredients/${r.toId}`}>{r.to.displayName}</Link> {r.interchangeable ? <Badge tone="good">interchangeable (reviewed)</Badge> : <Badge>not interchangeable</Badge>} <span className="text-ink-3">{r.notes}</span></li>)}
                {ing.relationsTo.map((r) => <li key={r.id}><Link href={`/ingredients/${r.fromId}`}>{r.from.displayName}</Link> is <strong>{label(r.relationType)}</strong> this ingredient <span className="text-ink-3">{r.notes}</span></li>)}
              </ul>
            )}
          </Card>
        </div>
      )}

      {tab === 'properties' && (
        <>
          {conflicts.length === 0 && <EmptyState title="No property facts yet">Facts must cite a source. Add one below or import from a permitted source.</EmptyState>}
          {conflicts.map((g) => (
            <Card key={g.propertyType} title={<span>{label(g.propertyType)} {g.conflict && <Badge tone="warn">sources disagree</Badge>}</span>} className="mb-3">
              <TableWrap><table><thead><tr><th>Value (as stated)</th><th>Normalized</th><th>Conditions</th><th>Provenance</th><th>Flags</th></tr></thead><tbody>
                {g.facts.map((f) => (
                  <tr key={f.id}>
                    <td className="tabular-nums">{f.originalValue} {f.originalUnit}</td>
                    <td className="tabular-nums text-ink-2">{f.normalizedValue !== null ? `${num(f.normalizedValue)} ${f.normalizedUnit}` : f.normalizedMin !== null ? `${num(f.normalizedMin)}–${num(f.normalizedMax)} ${f.normalizedUnit}` : '—'}<div className="text-xs text-ink-3">{f.conversionMethod}</div></td>
                    <td className="text-xs text-ink-2">{[f.testConditions, f.medium, f.temperatureC !== null ? `${num(f.temperatureC)} °C` : null, f.phConditions].filter(Boolean).join(' · ') || '—'}</td>
                    <td><Provenance source={src(f.sourceId)} entryMode={f.entryMode} reviewStatus={f.reviewStatus} location={f.sourceLocation} /></td>
                    <td>{f.qualityFlags.map((q) => <Badge key={q} tone="warn">{label(q)}</Badge>)}</td>
                  </tr>
                ))}
              </tbody></table></TableWrap>
            </Card>
          ))}
          {ing.facts.some((f) => f.supersededAt) && (
            <details className="mb-4 text-sm"><summary className="cursor-pointer text-ink-2">Superseded facts ({ing.facts.filter((f) => f.supersededAt).length}) — preserved for history</summary>
              <ul className="mt-2 space-y-1">{ing.facts.filter((f) => f.supersededAt).map((f) => <li key={f.id} className="text-ink-3">{label(f.propertyType)}: {f.originalValue} {f.originalUnit} — superseded {fmt(f.supersededAt)}</li>)}</ul>
            </details>
          )}
          {can(s.principal, 'fact:write') && (
            <Card title="Add a sourced fact">
              <form action={addFactAction} className="grid gap-3 sm:grid-cols-3">
                <input type="hidden" name="id" value={ing.id} />
                <Field label="Property"><select name="propertyType">{PROPERTY_TYPES.map((p) => <option key={p} value={p}>{label(p)}</option>)}</select></Field>
                <Field label="Value (as stated)"><input name="value" required /></Field>
                <Field label="Unit" hint="Leave empty for qualitative values"><input name="unit" placeholder="e.g. °C, % w/w, mPa·s" /></Field>
                <Field label="Source *"><select name="sourceId" required>{allSources.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</select></Field>
                <Field label="Source location"><input name="sourceLocation" placeholder="URL, page, table" /></Field>
                <Field label="Test conditions"><input name="testConditions" /></Field>
                <Field label="Supersedes (fact to correct)"><select name="supersedes"><option value="">— new fact —</option>{currentFacts.map((f) => <option key={f.id} value={f.id}>{label(f.propertyType)}: {f.originalValue} {f.originalUnit ?? ''}</option>)}</select></Field>
                <Field label="Reason (if correcting)"><input name="reason" /></Field>
                <div className="self-end"><Button>Add fact (submitted for review)</Button></div>
              </form>
            </Card>
          )}
        </>
      )}

      {tab === 'functions' && (
        <Card title="Cosmetic functions">
          {ing.functions.length === 0 ? <p className="text-sm text-ink-3">No functions recorded.</p> : (
            <ul className="space-y-2 text-sm">{ing.functions.map((f) => <li key={f.id}><strong>{f.function.label}</strong> <span className="text-ink-3">({label(f.basis ?? 'unspecified')})</span><Provenance source={src(f.sourceId)} entryMode={f.entryMode} reviewStatus={f.reviewStatus} /></li>)}</ul>
          )}
          {canWrite && (
            <form action={addFunctionAction} className="mt-4 grid gap-2 border-t border-line pt-4 sm:grid-cols-4">
              <input type="hidden" name="id" value={ing.id} />
              <select name="code">{(await prisma.functionTerm.findMany({ orderBy: { label: 'asc' } })).map((f) => <option key={f.code} value={f.code}>{f.label}</option>)}</select>
              <select name="basis">{['SOURCE_DECLARED', 'SUPPLIER', 'LITERATURE', 'REGULATORY_LISTING'].map((b) => <option key={b} value={b}>{label(b)}</option>)}</select>
              <select name="sourceId">{allSources.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</select>
              <Button variant="secondary">Add function</Button>
            </form>
          )}
        </Card>
      )}

      {tab === 'concentrations' && (
        <>
          <Notice title="Concentration record types are never combined">Supplier recommendations, literature-tested levels, regulatory maxima, internal ranges and observed commercial use are separate records. A supplier recommendation is not a regulatory limit.</Notice>
          {(['REGULATORY_MAXIMUM', 'LITERATURE_TESTED', 'SUPPLIER_RECOMMENDATION', 'INTERNAL_RANGE', 'OBSERVED_COMMERCIAL_USE'] as const).map((t) => {
            const rows = ing.concentrations.filter((c) => c.recordType === t)
            return (
              <Card key={t} title={label(t)} className="mb-3">
                {rows.length === 0 ? <p className="text-sm text-ink-3">None recorded.</p> : (
                  <TableWrap><table><thead><tr><th>Range</th><th>Context</th><th>Restriction / conditions</th><th>Provenance</th></tr></thead><tbody>
                    {rows.map((c) => <tr key={c.id}><td className="tabular-nums">{[num(c.minValue), num(c.maxValue)].some((x) => x !== null) ? `${num(c.minValue) ?? '—'} – ${num(c.maxValue) ?? '—'}` : num(c.typicalValue)} {c.unit}</td><td className="text-xs">{[c.productCategory, label(c.applicationType), c.jurisdiction].filter(Boolean).join(' · ')}</td><td className="text-xs text-ink-2">{c.restriction ?? c.testConditions ?? c.notes}</td><td><Provenance source={src(c.sourceId)} entryMode={c.entryMode} reviewStatus={c.reviewStatus} location={c.sourceLocation} /></td></tr>)}
                  </tbody></table></TableWrap>
                )}
              </Card>
            )
          })}
          {can(s.principal, 'fact:write') && (
            <Card title="Add a concentration record">
              <form action={addConcentrationAction} className="grid gap-3 sm:grid-cols-4">
                <input type="hidden" name="id" value={ing.id} />
                <Field label="Record type"><select name="recordType">{['SUPPLIER_RECOMMENDATION', 'LITERATURE_TESTED', 'INTERNAL_RANGE', 'OBSERVED_COMMERCIAL_USE'].map((t) => <option key={t} value={t}>{label(t)}</option>)}</select></Field>
                <Field label="Min"><input name="min" inputMode="decimal" /></Field><Field label="Max"><input name="max" inputMode="decimal" /></Field><Field label="Typical"><input name="typical" inputMode="decimal" /></Field>
                <Field label="Unit"><input name="unit" defaultValue="% w/w" /></Field>
                <Field label="Basis"><select name="basis"><option>ACTIVE</option><option>AS_SUPPLIED</option><option>UNKNOWN</option></select></Field>
                <Field label="Application"><select name="applicationType"><option>RINSE_OFF</option><option>LEAVE_ON</option><option>BOTH</option><option>UNKNOWN</option></select></Field>
                <Field label="Product category"><input name="productCategory" /></Field>
                <Field label="Source *"><select name="sourceId" required>{allSources.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</select></Field>
                <Field label="Source location"><input name="sourceLocation" /></Field>
                <div className="self-end"><Button variant="secondary">Add</Button></div>
              </form>
              <p className="mt-2 text-xs text-ink-3">Regulatory maxima are created from regulatory records, not entered here.</p>
            </Card>
          )}
        </>
      )}

      {tab === 'compatibility' && (
        <Card title="Compatibility and incompatibility">
          {currentFacts.filter((f) => ['INCOMPATIBILITIES', 'STABILITY_RANGE', 'PH_RANGE', 'OXIDATION_SENSITIVITY', 'LIGHT_SENSITIVITY', 'HYDROLYSIS_SENSITIVITY'].includes(f.propertyType)).length === 0
            ? <EmptyState title="No source-backed compatibility data">Compatibility reasoning (Phase 4) will only use sourced incompatibility facts and reviewed graph edges. Add incompatibility or stability facts on the Properties tab.</EmptyState>
            : <ul className="space-y-2 text-sm">{currentFacts.filter((f) => ['INCOMPATIBILITIES', 'STABILITY_RANGE', 'PH_RANGE', 'OXIDATION_SENSITIVITY', 'LIGHT_SENSITIVITY', 'HYDROLYSIS_SENSITIVITY'].includes(f.propertyType)).map((f) => <li key={f.id}><strong>{label(f.propertyType)}:</strong> {f.originalValue} {f.originalUnit}<Provenance source={src(f.sourceId)} entryMode={f.entryMode} reviewStatus={f.reviewStatus} /></li>)}</ul>}
        </Card>
      )}

      {tab === 'safety' && (
        <Card title="Safety review records">
          {ing.safetyReviews.length === 0 ? <EmptyState title="No safety review records">Absence of a record is not evidence of safety.</EmptyState> : (
            <ul className="space-y-3 text-sm">{ing.safetyReviews.map((r) => (
              <li key={r.id} className="border-b border-line pb-3">
                <div className="flex flex-wrap gap-2"><Badge tone="brand">{r.reviewBody}</Badge><Badge>{label(r.endpoint)}</Badge>{r.highRisk && <Badge tone="bad">high-risk: second reviewer required</Badge>}<EntryModeBadge mode={r.entryMode} /><ReviewBadge status={r.reviewStatus} /></div>
                <p className="mt-1 text-ink-2">{r.conclusion}</p>
                <div className="text-xs text-ink-3">{r.exposureRoute} · evidence strength: {r.evidenceStrength ?? 'not assessed'} {r.url && <> · <a href={r.url} target="_blank" rel="noreferrer">source</a></>}</div>
              </li>))}</ul>
          )}
          <p className="mt-3 text-xs text-ink-3">This platform cannot establish ingredient safety. Safety conclusions require qualified safety assessment.</p>
        </Card>
      )}

      {tab === 'regulatory' && (
        <>
          <Notice kind="warn" title="Jurisdiction-specific and time-specific">{REGULATORY_DISCLAIMER} This system never reports an ingredient as “globally approved”.</Notice>
          {currentReg.length === 0 && <EmptyState title="No regulatory records">No record in any jurisdiction. Absence of a record does not mean the ingredient is allowed.</EmptyState>}
          {Object.keys(JURISDICTIONS).concat([...new Set(currentReg.map((r) => r.jurisdiction))].filter((j) => !JURISDICTIONS[j])).map((j) => {
            const rows = currentReg.filter((r) => r.jurisdiction === j)
            return (
              <Card key={j} title={`${JURISDICTIONS[j] ?? j} (${j})`} className="mb-3">
                {rows.length === 0 ? <p className="text-sm text-ink-3">No record for this jurisdiction.</p> : rows.map((r) => (
                  <div key={r.id} className="border-b border-line py-3 text-sm last:border-0">
                    <div className="flex flex-wrap items-center gap-2"><Badge tone={r.status === 'PROHIBITED' ? 'bad' : r.status === 'ALLOWED' ? 'good' : 'warn'}>{label(r.status)}</Badge>{isStale(r) && <Badge tone="bad">stale — re-verify</Badge>}<ReviewBadge status={r.reviewStatus} /><EntryModeBadge mode={r.entryMode} /></div>
                    <KeyValue items={[
                      ['Authority', r.authority], ['Regulation', r.regulationRef], ['Maximum', r.maxConcentration !== null ? `${num(r.maxConcentration)} ${r.maxConcentrationUnit ?? ''}` : null],
                      ['Restrictions', r.productRestrictions], ['Warnings', r.warningRequirements], ['Labelling', r.labelingRequirements], ['Preservative status', r.preservativeStatus], ['Color additive', r.colorAdditiveStatus],
                      ['Effective date', fmt(r.effectiveDate)], ['Last reviewed against source', r.lastCheckedAt ? fmt(r.lastCheckedAt) : 'Never'],
                      ['Source', <span key="s">{src(r.sourceId)?.name}{r.sourceUrl && <> · <a href={r.sourceUrl} target="_blank" rel="noreferrer">official text</a></>}</span>], ['Notes', r.notes],
                    ]} />
                  </div>
                ))}
              </Card>
            )
          })}
          {can(s.principal, 'regulatory:write') && (
            <Card title="Add regulatory record (regulatory reviewers)">
              <form action={addRegulatoryAction} className="grid gap-3 sm:grid-cols-3">
                <input type="hidden" name="id" value={ing.id} />
                <Field label="Jurisdiction"><input name="jurisdiction" placeholder="US, EU, UK, CA…" required /></Field>
                <Field label="Authority"><input name="authority" required /></Field>
                <Field label="Regulation / annex"><input name="regulationRef" /></Field>
                <Field label="Status"><select name="status">{['ALLOWED', 'RESTRICTED', 'PROHIBITED', 'CONDITIONALLY_PERMITTED', 'NOT_LISTED', 'NOT_A_COSMETIC_INGREDIENT', 'UNKNOWN'].map((x) => <option key={x} value={x}>{label(x)}</option>)}</select></Field>
                <Field label="Max concentration"><input name="max" inputMode="decimal" /></Field><Field label="Unit"><input name="unit" placeholder="% w/w" /></Field>
                <Field label="Restrictions"><input name="restrictions" /></Field><Field label="Warnings"><input name="warnings" /></Field>
                <Field label="Source *"><select name="sourceId" required>{allSources.filter((x) => x.type === 'REGULATORY').map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</select></Field>
                <Field label="Official URL"><input name="sourceUrl" type="url" /></Field><Field label="Effective date"><input name="effective" type="date" /></Field><Field label="Checked against source on"><input name="checked" type="date" /></Field>
                <div><Button>Add record</Button></div>
              </form>
            </Card>
          )}
        </>
      )}

      {tab === 'evidence' && (
        <Card title="Linked evidence">
          {ing.evidenceLinks.length === 0 ? <EmptyState title="No linked evidence" /> : (
            <TableWrap><table><thead><tr><th>Study</th><th>Type</th><th>Level</th><th>Direction</th><th>Status</th></tr></thead><tbody>
              {ing.evidenceLinks.map((l) => (
                <tr key={l.id}><td className="min-w-72"><Link href={`/evidence/${l.evidenceId}`}>{l.evidence.title}</Link><div className="text-xs text-ink-3">{l.evidence.pmid && `PMID ${l.evidence.pmid}`}{l.evidence.medicalContext && ' · medical/drug context'}</div></td>
                  <td className="text-xs">{label(l.evidence.studyType)}</td><td>{l.evidence.evidenceLevel ? <Badge tone="brand">L{l.evidence.evidenceLevel}</Badge> : '—'}</td><td className="text-xs">{label(l.direction)}</td><td><EntryModeBadge mode={l.entryMode} /> <ReviewBadge status={l.evidence.reviewStatus} /></td></tr>
              ))}
            </tbody></table></TableWrap>
          )}
          <p className="mt-3 text-xs text-ink-3">Evidence level describes evidence type, not strength, and does not authorize a claim. Study type and links were proposed from titles and await scientific review.</p>
        </Card>
      )}

      {tab === 'patents' && (
        <Card title="Patent mentions">
          <Notice kind="warn">{DISCLAIMERS.patent}</Notice>
          {ing.patentLinks.length === 0 ? <p className="text-sm text-ink-3">No patent mentions recorded.</p> : (
            <ul className="space-y-2 text-sm">{ing.patentLinks.map((p) => <li key={p.id}><Link href={`/patents/${p.patentId}`}>{p.patent.publicationNumber}</Link> — {p.patent.title} <Badge>{label(p.relation)}</Badge> <EntryModeBadge mode={p.entryMode} /></li>)}</ul>
          )}
        </Card>
      )}

      {tab === 'suppliers' && (
        <Card title="Raw materials containing this ingredient">
          <Notice>{DISCLAIMERS.supplier}</Notice>
          {ing.rawComponents.filter((c) => canViewRecord(s.principal, c.rawMaterial, 'rawmaterial:read')).length === 0 ? <p className="text-sm text-ink-3">No raw materials visible to your organization.</p> : (
            <ul className="space-y-2 text-sm">{ing.rawComponents.filter((c) => canViewRecord(s.principal, c.rawMaterial, 'rawmaterial:read')).map((c) => <li key={c.id}><Link href={`/raw-materials/${c.rawMaterialId}`}>{c.rawMaterial.tradeName}</Link> · {c.rawMaterial.supplier?.name} · role {label(c.role)} {c.percentMin !== null && `· ${num(c.percentMin)}–${num(c.percentMax)}%`} {c.rawMaterial.isSample && <Badge tone="warn">sample</Badge>}</li>)}</ul>
          )}
        </Card>
      )}

      {tab === 'products' && (
        <Card title="Products declaring this ingredient (current ingredient-list versions)">
          {currentProducts.length === 0 ? <p className="text-sm text-ink-3">No products.</p> : (
            <TableWrap><table><thead><tr><th>Product</th><th>Displayed as</th><th>Position</th><th>Identity confidence</th></tr></thead><tbody>
              {currentProducts.map((l) => <tr key={l.id}><td><Link href={`/products/${l.productVersion.productId}`}>{l.productVersion.product.brand} — {l.productVersion.product.name}</Link></td><td>{l.displayedName}</td><td className="tabular-nums">{l.position}</td><td><Badge tone={l.parsingStatus === 'MATCHED' ? 'good' : 'warn'}>{l.identityConfidence.toFixed(2)} {label(l.parsingStatus)}</Badge></td></tr>)}
            </tbody></table></TableWrap>
          )}
          <p className="mt-3 text-xs text-ink-3">Ingredient order does not indicate concentration.</p>
        </Card>
      )}

      {tab === 'formulas' && (
        <Card title="Formulas using this ingredient">
          {!can(s.principal, 'formula:read') ? <p className="text-sm text-ink-3">You do not have access to formulas.</p> : visibleFormulaLines.length === 0 ? <p className="text-sm text-ink-3">No formulas visible to you.</p> : (
            <ul className="space-y-1 text-sm">{visibleFormulaLines.map((l) => <li key={l.id}><Link href={`/formulas/${l.formulaVersion.formulaId}`}>{l.formulaVersion.formula.code}</Link> v{l.formulaVersion.versionNumber} · {l.percent !== null ? `${num(l.percent)}%` : 'q.s.'} · {l.functionalRole} {l.formulaVersion.formula.isSample && <Badge tone="warn">sample</Badge>}</li>)}</ul>
          )}
        </Card>
      )}

      {tab === 'phenotypes' && (
        <Card title="Hair and scalp phenotype links">
          {ing.evidenceLinks.length === 0 ? <p className="text-sm text-ink-3">No phenotype links.</p> : <PhenotypeLinks evidenceIds={ing.evidenceLinks.map((l) => l.evidenceId)} />}
          <p className="mt-3 text-xs text-ink-3">Links come from literature metadata (proposed from titles). They describe what was studied, not demonstrated effects. Outcome links from Hair Passport arrive in Phase 3.</p>
        </Card>
      )}

      {tab === 'outcomes' && (
        <Card title="Outcome data">
          <Notice kind="warn" title={DISCLAIMERS.observational}>Real-world outcome relationships require Hair Passport data (Phase 3). No real participant outcomes exist yet; mock records are excluded from research views.</Notice>
        </Card>
      )}

      {tab === 'graph' && <IngredientGraph id={ing.id} />}

      {tab === 'history' && <History id={ing.id} />}
    </>
  )

  async function PhenotypeLinks({ evidenceIds }: { evidenceIds: string[] }) {
    const links = await prisma.evidenceLink.findMany({ where: { evidenceId: { in: evidenceIds }, ontologyTermId: { not: null } }, include: { ontologyTerm: true, evidence: true } })
    if (!links.length) return <p className="text-sm text-ink-3">No phenotype terms on the linked evidence.</p>
    return <ul className="space-y-1 text-sm">{links.map((l) => <li key={l.id}><Badge tone="brand">{l.ontologyTerm!.label}</Badge> — <Link href={`/evidence/${l.evidenceId}`}>{l.evidence.title.slice(0, 90)}</Link> <span className="text-xs text-ink-3">({label(l.direction)}, {l.entryMode === 'AI_EXTRACTED' ? 'AI draft' : 'manual'})</span></li>)}</ul>
  }

  async function IngredientGraph({ id: gid }: { id: string }) {
    if (!can(s.principal, 'graph:read')) return <PermissionDenied permission="graph:read" />
    const g = await postgresGraphStore.neighborhood(s.principal, 'Ingredient', gid, { limit: 60 })
    return <><GraphSvg focusKey={`Ingredient:${gid}`} nodes={g.nodes} links={g.links} /><p className="mt-2 text-sm"><Link href={`/graph?type=Ingredient&id=${gid}`}>Open in graph explorer →</Link></p></>
  }

  async function History({ id: hid }: { id: string }) {
    const [logs, events] = await Promise.all([
      prisma.auditLog.findMany({ where: { OR: [{ entityType: 'Ingredient', entityId: hid }, { entityType: 'IngredientFact', entityId: { in: ing.facts.map((f) => f.id) } }, { entityType: 'RegulatoryRecord', entityId: { in: ing.regulatory.map((r) => r.id) } }] }, orderBy: { at: 'desc' }, take: 100 }),
      prisma.identityResolutionEvent.findMany({ where: { OR: [{ primaryIngredientId: hid }, { secondaryIngredientId: hid }] }, orderBy: { createdAt: 'desc' } }),
    ])
    return (
      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="Change history (append-only audit log)">
          <ul className="space-y-2 text-sm">{logs.map((l) => (
            <li key={String(l.id)} className="border-b border-line pb-2"><div className="flex flex-wrap gap-2"><Badge>{l.action}</Badge><span className="text-xs text-ink-3">{l.at.toISOString().replace('T', ' ').slice(0, 19)} · {l.actorLabel}</span></div>
              {l.reason && <div className="text-ink-2">Reason: {l.reason}</div>}
              {(l.before || l.after) && <details className="text-xs"><summary className="cursor-pointer text-ink-3">previous / new value</summary><pre className="mt-1 max-h-48 overflow-auto whitespace-pre-wrap rounded bg-paper-2 p-2">{JSON.stringify({ before: l.before, after: l.after }, null, 1)}</pre></details>}
            </li>))}</ul>
        </Card>
        <Card title="Identity-resolution events">
          {events.length === 0 ? <p className="text-sm text-ink-3">None.</p> : <ul className="space-y-2 text-sm">{events.map((e) => <li key={e.id}><Badge tone={e.type === 'IDENTIFIER_REJECTED' ? 'warn' : 'neutral'}>{label(e.type)}</Badge> {e.reason} <span className="text-xs text-ink-3">{fmt(e.createdAt)}{e.reversedAt && ' · reversed'}</span><pre className="mt-1 whitespace-pre-wrap text-xs text-ink-3">{JSON.stringify(e.snapshot)}</pre></li>)}</ul>}
        </Card>
      </div>
    )
  }
}
