import type { ResearchWorkflow } from '@prisma/client'
import { ActionForm } from '@/components/ActionForm'
import { IngredientPicker } from '@/components/IngredientPicker'
import { DERIVED_FILTERS } from '@/lib/classify'
import { CATEGORIES, PREFERENCES, MARKET_GUIDE } from '@/lib/research/brief'
import { startResearchAction } from './actions'

type Opt = { id: string; label: string; detail: string | null }
const MARKETS = Object.entries(MARKET_GUIDE).map(([k, v]) => [k, v.label] as const)

function Text({ name, label, placeholder, hint, required, rows, defaultValue }: { name: string; label: string; placeholder?: string; hint?: string; required?: boolean; rows?: number; defaultValue?: string }) {
  return (
    <label className="block text-sm">
      <span className="mb-1 block font-medium">{label}</span>
      {rows ? <textarea name={name} rows={rows} placeholder={placeholder} required={required} defaultValue={defaultValue} /> : <input name={name} placeholder={placeholder} required={required} defaultValue={defaultValue} />}
      {hint && <span className="mt-1 block text-xs text-ink-3">{hint}</span>}
    </label>
  )
}

function Checks({ name, label, options, hint, defaults = [] }: { name: string; label: string; options: readonly (readonly [string, string])[]; hint?: string; defaults?: string[] }) {
  return (
    <fieldset className="text-sm">
      <legend className="mb-1 font-medium">{label}</legend>
      <div className="flex flex-wrap gap-x-4 gap-y-1.5">{options.map(([v, l]) => <label key={v} className="inline-flex items-center gap-1.5"><input type="checkbox" name={name} value={v} defaultChecked={defaults.includes(v)} />{l}</label>)}</div>
      {hint && <span className="mt-1 block text-xs text-ink-3">{hint}</span>}
    </fieldset>
  )
}

function Application() {
  return (
    <label className="block text-sm"><span className="mb-1 block font-medium">Product type</span>
      <select name="application" defaultValue="UNKNOWN"><option value="UNKNOWN">Not specified</option><option value="RINSE_OFF">Rinse-off (shampoo, conditioner, mask)</option><option value="LEAVE_ON">Leave-on (leave-in, styler, oil, serum)</option></select>
    </label>
  )
}

function Common({ workflow, title }: { workflow: ResearchWorkflow; title: string }) {
  return (
    <>
      <input type="hidden" name="workflow" value={workflow} />
      <div className="grid gap-4 sm:grid-cols-[2fr_1fr]">
        <Text name="title" label="Project title" defaultValue={title} required />
        <label className="block text-sm"><span className="mb-1 block font-medium">Who can see it</span><select name="visibility" defaultValue="ORGANIZATION"><option value="ORGANIZATION">My organization</option><option value="RESTRICTED">Only me and invited members</option></select></label>
      </div>
      <Text name="objective" label="Research objective" rows={2} placeholder="What decision will this research inform?" hint="Editable later. Appears at the top of reports." />
    </>
  )
}

export function WorkflowForm({ workflow, initial, formulas, rawMaterials, cosingFunctions }: { workflow: ResearchWorkflow; initial: Opt[]; formulas: { id: string; label: string }[]; rawMaterials: { id: string; label: string }[]; cosingFunctions: string[] }) {
  switch (workflow) {
    case 'SUBSTITUTES':
      return (
        <ActionForm action={startResearchAction} submitLabel="Find substitutes" pendingLabel="Investigating candidates…">
          <Common workflow={workflow} title={initial[0] ? `Substitutes for ${initial[0].label}` : 'Ingredient substitution'} />
          <IngredientPicker name="ingredient" label="Ingredient to replace" initial={initial.slice(0, 1)} required />
          <Text name="reason" label="Why do you want an alternative?" rows={2} placeholder="e.g. keep wet-detangling and slip, but silicone-free and easier to source" hint="Recorded with the research and used to frame the brief." />
          <Checks name="avoid" label="Exclude these classes" options={DERIVED_FILTERS.map((d) => [d.code, d.label] as const)} hint="Rule-based classes from INCI naming; screening aids." />
          <details className="text-sm"><summary className="cursor-pointer font-medium">Advanced: functions to preserve</summary>
            <p className="my-2 text-xs text-ink-3">By default the ingredient’s own official CosIng functions are used.</p>
            <Checks name="keep" label="Official functions" options={cosingFunctions.map((f) => [f, f.replace(/-/g, ' ')] as const)} />
          </details>
          <Application />
        </ActionForm>
      )
    case 'FORMULATION':
      return (
        <ActionForm action={startResearchAction} submitLabel="Research this formulation" pendingLabel="Screening formulation…">
          <Common workflow={workflow} title="Formulation research" />
          {formulas.length > 0 && <label className="block text-sm"><span className="mb-1 block font-medium">Saved formula</span><select name="formulaId" defaultValue=""><option value="">— or paste lines below —</option>{formulas.map((f) => <option key={f.id} value={f.id}>{f.label}</option>)}</select><span className="mt-1 block text-xs text-ink-3">Only formulas your organization can see are listed. Formulas never leave your workspace.</span></label>}
          <Text name="lines" label="Formula lines" rows={8} placeholder={'Aqua q.s.\nCetearyl Alcohol 4\nBehentrimonium Chloride 2\nGlycerin 3\nPhenoxyethanol 0.8'} hint="One ingredient per line with % (or q.s.), or paste a comma-separated ingredient list without percentages." />
          <label className="block text-sm"><span className="mb-1 block font-medium">…or upload a formula file</span><input type="file" name="file" accept=".csv,.txt,text/csv,text/plain" /><span className="mt-1 block text-xs text-ink-3">CSV or text, one ingredient per line (name, %). Stored only in this project.</span></label>
          <div className="grid gap-4 sm:grid-cols-2"><Text name="ph" label="Target pH (optional)" placeholder="e.g. 4.5" /><Application /></div>
          <Checks name="market" label="Target markets" options={MARKETS} defaults={['US', 'EU']} />
        </ActionForm>
      )
    case 'CLAIM':
      return (
        <ActionForm action={startResearchAction} submitLabel="Investigate claim" pendingLabel="Searching evidence…">
          <Common workflow={workflow} title="Claim investigation" />
          <Text name="claim" label="Proposed claim wording" rows={2} required placeholder="e.g. Reduces breakage by 50% and leaves curls visibly more defined" />
          <IngredientPicker name="ingredient" label="Ingredients the claim relies on (optional)" multiple initial={initial} hint="Ingredient names in the claim text are also detected automatically." />
          <Checks name="market" label="Markets" options={MARKETS} defaults={['US', 'EU']} />
          <Application />
        </ActionForm>
      )
    case 'SUPPLIERS':
      return (
        <ActionForm action={startResearchAction} submitLabel="Compare suppliers" pendingLabel="Comparing…">
          <Common workflow={workflow} title={initial[0] ? `Suppliers for ${initial[0].label}` : 'Supplier comparison'} />
          <IngredientPicker name="ingredient" label="Ingredient" initial={initial.slice(0, 1)} />
          {rawMaterials.length > 0 && <label className="block text-sm"><span className="mb-1 block font-medium">…or a raw material on file</span><select name="rawMaterialId" defaultValue=""><option value="">—</option>{rawMaterials.map((r) => <option key={r.id} value={r.id}>{r.label}</option>)}</select></label>}
          <Text name="requirements" label="Requirements (optional)" placeholder="e.g. COSMOS-approved, EU stock, MOQ under 25 kg" />
        </ActionForm>
      )
    case 'COMPARISON':
      return (
        <ActionForm action={startResearchAction} submitLabel="Compare" pendingLabel="Comparing…">
          <Common workflow={workflow} title={initial.length ? `Comparison: ${initial.map((i) => i.label).join(' vs ')}` : 'Ingredient comparison'} />
          <IngredientPicker name="ingredient" label="Ingredients to compare (2–6)" multiple max={6} initial={initial} />
        </ActionForm>
      )
    case 'GENERAL':
      return (
        <ActionForm action={startResearchAction} submitLabel="Ask" pendingLabel="Retrieving records…">
          <Common workflow={workflow} title="Research question" />
          <Text name="question" label="Your question" rows={3} required placeholder="e.g. Which conditioning systems should be investigated for improved wet detangling?" hint="Answered only from records in this platform, with citations. Not a substitute for testing." />
        </ActionForm>
      )
    case 'PRODUCT_BRIEF':
      return null
  }
}

export const CATEGORY_OPTIONS = Object.entries(CATEGORIES).map(([k, v]) => [k, v.label] as const)
export const PREFERENCE_OPTIONS = Object.entries(PREFERENCES).map(([k, v]) => [k, v.label] as const)
export const MARKET_OPTIONS = MARKETS
