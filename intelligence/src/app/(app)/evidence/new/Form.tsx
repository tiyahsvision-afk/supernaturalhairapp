'use client'
import { useActionState } from 'react'
import { createEvidenceAction } from '../actions'

const TYPES = ['PEER_REVIEWED_STUDY', 'REVIEW', 'SYSTEMATIC_REVIEW', 'META_ANALYSIS', 'IN_VITRO', 'EX_VIVO', 'ANIMAL', 'HUMAN_OBSERVATIONAL', 'CONTROLLED_HUMAN', 'PROFESSIONAL_CONSENSUS', 'REGULATORY_ASSESSMENT', 'SUPPLIER_STUDY', 'INTERNAL_STUDY', 'CASE_REPORT', 'PATENT_EXAMPLE', 'OTHER']

export function NewEvidenceForm() {
  const [state, action, pending] = useActionState(createEvidenceAction, undefined)
  return (
    <form action={action} className="grid max-w-3xl gap-3 sm:grid-cols-3">
      <label className="text-sm sm:col-span-3"><span className="mb-1 block font-medium">Title *</span><input name="title" required /></label>
      <label className="text-sm"><span className="mb-1 block font-medium">PMID</span><input name="pmid" inputMode="numeric" /></label>
      <label className="text-sm"><span className="mb-1 block font-medium">DOI</span><input name="doi" /></label>
      <label className="text-sm"><span className="mb-1 block font-medium">Source URL</span><input name="url" type="url" /></label>
      <label className="text-sm"><span className="mb-1 block font-medium">Study type *</span><select name="studyType">{TYPES.map((t) => <option key={t} value={t}>{t.replace(/_/g, ' ').toLowerCase()}</option>)}</select></label>
      <label className="text-sm"><span className="mb-1 block font-medium">Evidence level (1–7)</span><select name="level"><option value="">Not assigned</option>{[1, 2, 3, 4, 5, 6, 7].map((l) => <option key={l}>{l}</option>)}</select></label>
      <label className="text-sm"><span className="mb-1 block font-medium">Sample size</span><input name="sampleSize" inputMode="numeric" /></label>
      <label className="text-sm"><span className="mb-1 block font-medium">Journal</span><input name="journal" /></label>
      <label className="text-sm sm:col-span-2"><span className="mb-1 block font-medium">Population</span><input name="population" /></label>
      <label className="text-sm sm:col-span-3"><span className="mb-1 block font-medium">Source conclusion (paraphrase; the authors’ conclusion)</span><textarea name="sourceConclusion" rows={2} /></label>
      <label className="text-sm sm:col-span-3"><span className="mb-1 block font-medium">Limitations</span><textarea name="limitations" rows={2} /></label>
      <label className="text-sm sm:col-span-3"><span className="mb-1 block font-medium">Ingredient IDs (ing:uuid, space-separated)</span><input name="ingredients" /></label>
      {state?.error && <p role="alert" className="text-sm text-bad sm:col-span-3">{state.error}</p>}
      <div><button disabled={pending} className="rounded-full border border-brand bg-brand px-5 py-2 text-sm font-semibold text-[#0d2440]">Save and submit for review</button></div>
    </form>
  )
}
