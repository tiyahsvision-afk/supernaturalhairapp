'use client'
import { useActionState, useState, type ReactNode } from 'react'
import { startResearchAction } from '../workbench/actions'

type Opts = readonly (readonly [string, string])[]

function Step({ n, active, title, help, children }: { n: number; active: boolean; title: string; help: string; children: ReactNode }) {
  return (
    <section className={active ? 'block' : 'hidden'} aria-hidden={!active}>
      <div className="mb-1 text-xs font-semibold uppercase tracking-widest text-ink-3">Question {n} of 10</div>
      <h2 className="text-2xl text-ink">{title}</h2>
      <p className="mb-4 mt-1 text-sm text-ink-2">{help}</p>
      {children}
    </section>
  )
}

function Choice({ name, options, type = 'checkbox', defaults = [] }: { name: string; options: Opts; type?: 'checkbox' | 'radio'; defaults?: string[] }) {
  return (
    <div className="grid gap-2 sm:grid-cols-2">
      {options.map(([v, l]) => (
        <label key={v} className="flex cursor-pointer items-center gap-2 rounded-xl border border-line bg-paper px-3 py-2.5 text-sm hover:border-brand-200 has-[:checked]:border-brand has-[:checked]:bg-brand-100">
          <input type={type} name={name} value={v} defaultChecked={defaults.includes(v)} />{l}
        </label>
      ))}
    </div>
  )
}

export function FounderWizard({ categories, preferences, markets, concerns }: { categories: Opts; preferences: Opts; markets: Opts; concerns: Opts }) {
  const [step, setStep] = useState(1)
  const [state, act, pending] = useActionState(startResearchAction, undefined)
  const last = step === 10
  return (
    <form action={act} className="rounded-2xl border border-line bg-paper p-5 sm:p-8">
      <input type="hidden" name="workflow" value="PRODUCT_BRIEF" />
      <div className="mb-6 h-1.5 overflow-hidden rounded-full bg-paper-2" role="progressbar" aria-valuemin={1} aria-valuemax={10} aria-valuenow={step}><div className="h-full rounded-full bg-brand transition-all" style={{ width: `${step * 10}%` }} /></div>
      <Step n={1} active={step === 1} title="What are you making?" help="Pick the product category. This decides which functional building blocks the brief covers.">
        <Choice name="category" type="radio" options={categories} defaults={['leave-in']} />
        <label className="mt-4 block text-sm"><span className="mb-1 block font-medium">Working name (optional)</span><input name="title" placeholder="e.g. Daily moisture leave-in" /></label>
      </Step>
      <Step n={2} active={step === 2} title="Who is it for?" help="Describe your target customer: hair type, routine, lifestyle, what they use today.">
        <textarea name="targetCustomer" rows={3} placeholder="e.g. Women with 4B/4C hair who wear wash-and-gos and protective styles" />
      </Step>
      <Step n={3} active={step === 3} title="What should it do?" help="Describe the performance you want in plain words. We will flag wording that sounds like a drug or unprovable claim.">
        <textarea name="performance" rows={3} placeholder="e.g. Softer, easier to detangle, less breakage, moisture that lasts until the next wash day" />
      </Step>
      <Step n={4} active={step === 4} title="Which hair or scalp concerns?" help="These link to the evidence in the database.">
        <Choice name="concern" options={concerns} />
      </Step>
      <Step n={5} active={step === 5} title="Ingredient preferences" help="Positioning choices like sulfate-free or silicone-free filter the candidate ingredients.">
        <Choice name="preference" options={preferences} />
      </Step>
      <Step n={6} active={step === 6} title="Ingredients to investigate or avoid" help="Use INCI names where you can (e.g. Butyrospermum Parkii Butter). Separate with commas.">
        <label className="block text-sm"><span className="mb-1 block font-medium">Investigate</span><input name="investigate" placeholder="e.g. Shea butter, Panthenol, Aloe Barbadensis Leaf Juice" /></label>
        <label className="mt-3 block text-sm"><span className="mb-1 block font-medium">Avoid</span><input name="avoid" placeholder="e.g. Mineral Oil, Fragrance" /></label>
      </Step>
      <Step n={7} active={step === 7} title="Texture and sensory experience" help="How should it look, feel and smell? Your formulator will translate this into specifications.">
        <textarea name="texture" rows={3} placeholder="e.g. Lightweight cream, absorbs fast, no white cast, light fresh scent" />
      </Step>
      <Step n={8} active={step === 8} title="Where will you sell it?" help="Each market has its own registration, labelling and claims rules.">
        <Choice name="market" options={markets} defaults={['US']} />
      </Step>
      <Step n={9} active={step === 9} title="Target retail price" help="Used to frame cost questions for manufacturers. The platform does not invent ingredient prices.">
        <input name="retailPrice" placeholder="e.g. $18 for 8 oz" />
      </Step>
      <Step n={10} active={step === 10} title="Manufacturing constraints" help="Budget, minimum order quantities, timeline, certifications, packaging — anything that limits options.">
        <textarea name="constraints" rows={3} placeholder="e.g. First run under 2,000 units, launch in 6 months, recyclable packaging" />
        <p className="mt-4 rounded-xl border border-line bg-paper-2 p-3 text-xs text-ink-2">Your brief is a research document for discussion with a qualified cosmetic chemist or manufacturer. It is not a finished, safety-tested cosmetic formulation.</p>
      </Step>
      {state?.error && <p role="alert" className="mt-4 rounded-xl border border-bad/40 bg-paper-2 px-3 py-2 text-sm text-bad">{state.error}</p>}
      <div className="mt-6 flex items-center justify-between gap-2">
        <button type="button" onClick={() => setStep((s) => Math.max(1, s - 1))} disabled={step === 1} className="rounded-full border border-line px-4 py-2 text-sm disabled:opacity-40">Back</button>
        {/* Distinct keys: reusing one <button> element would turn the final "Next" click into a form submit. */}
        {last
          ? <button key="submit" type="submit" disabled={pending} className="rounded-full border border-brand bg-brand px-5 py-2 text-sm font-semibold text-[#0d2440] disabled:opacity-60">{pending ? 'Building your brief…' : 'Generate research brief'}</button>
          : <button key="next" type="button" onClick={() => setStep((s) => Math.min(10, s + 1))} className="rounded-full border border-brand bg-brand px-5 py-2 text-sm font-semibold text-[#0d2440]">Next</button>}
      </div>
    </form>
  )
}
