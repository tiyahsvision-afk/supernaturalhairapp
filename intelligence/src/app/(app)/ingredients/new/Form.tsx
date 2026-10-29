'use client'
import Link from 'next/link'
import { useActionState } from 'react'
import { createIngredientAction } from '../actions'

const IDENTITY = ['DEFINED_SUBSTANCE', 'SALT', 'ESTER', 'DERIVATIVE', 'ISOMER', 'POLYMER', 'COPOLYMER', 'PEPTIDE', 'PROTEIN', 'HYDROLYSATE', 'BOTANICAL_EXTRACT', 'BOTANICAL_FRACTION', 'ESSENTIAL_OIL', 'FIXED_OIL', 'WAX', 'FERMENT', 'LYSATE', 'FILTRATE', 'MINERAL', 'PROPRIETARY_BLEND', 'FRAGRANCE_MIXTURE', 'DELIVERY_SYSTEM', 'RAW_MATERIAL_BLEND', 'UVCB', 'UNKNOWN_COMPOSITION', 'OTHER_COMPLEX']
const MATERIAL = ['SMALL_MOLECULE', 'BOTANICAL_EXTRACT', 'BOTANICAL_FRACTION', 'PEPTIDE', 'PROTEIN', 'AMINO_ACID', 'LIPID', 'OIL', 'WAX', 'SURFACTANT', 'POLYMER', 'SILICONE', 'MINERAL', 'FERMENTATION_DERIVED', 'MICROBIOME_RELATED', 'PRESERVATIVE', 'FRAGRANCE_MATERIAL', 'COLORANT', 'UV_FILTER', 'DELIVERY_TECHNOLOGY', 'COMPLEX_MIXTURE', 'OTHER']
const ORIGIN = ['NATURAL', 'NATURALLY_DERIVED', 'SYNTHETIC', 'BIOTECH', 'UNKNOWN']
const label = (s: string) => s.replace(/_/g, ' ').toLowerCase()

export function NewIngredientForm({ families, sources }: { families: { slug: string; name: string }[]; sources: { key: string; name: string }[] }) {
  const [state, action, pending] = useActionState(createIngredientAction, undefined)
  return (
    <form action={action} className="grid max-w-3xl gap-4 sm:grid-cols-2">
      <label className="text-sm sm:col-span-2"><span className="mb-1 block font-medium">Canonical name (INCI where one exists) *</span><input name="canonicalName" required /></label>
      <label className="text-sm"><span className="mb-1 block font-medium">INCI name</span><input name="inciName" /></label>
      <label className="text-sm"><span className="mb-1 block font-medium">Common name</span><input name="commonName" /></label>
      <label className="text-sm"><span className="mb-1 block font-medium">Chemical name</span><input name="chemicalName" /></label>
      <label className="text-sm"><span className="mb-1 block font-medium">Family</span><select name="family"><option value="">—</option>{families.map((f) => <option key={f.slug} value={f.slug}>{f.name}</option>)}</select></label>
      <label className="text-sm"><span className="mb-1 block font-medium">Identity type *</span><select name="identityType" required>{IDENTITY.map((i) => <option key={i} value={i}>{label(i)}</option>)}</select></label>
      <label className="text-sm"><span className="mb-1 block font-medium">Material type *</span><select name="materialType" required>{MATERIAL.map((i) => <option key={i} value={i}>{label(i)}</option>)}</select></label>
      <label className="text-sm"><span className="mb-1 block font-medium">Origin</span><select name="originType">{ORIGIN.map((i) => <option key={i} value={i}>{label(i)}</option>)}</select></label>
      <label className="text-sm"><span className="mb-1 block font-medium">Source of this identity *</span><select name="sourceKey" required>{sources.map((s) => <option key={s.key} value={s.key}>{s.name}</option>)}</select></label>
      <label className="text-sm sm:col-span-2"><span className="mb-1 block font-medium">Synonyms / aliases (one per line)</span><textarea name="aliases" rows={3} /></label>
      <label className="text-sm sm:col-span-2"><span className="mb-1 block font-medium">Description</span><textarea name="description" rows={3} /></label>
      {state?.error && <p role="alert" className="text-sm text-bad sm:col-span-2">{state.error}{state.existingId && <> — <Link href={`/ingredients/${state.existingId}`}>open existing record</Link></>}</p>}
      <div className="sm:col-span-2"><button disabled={pending} className="rounded-full border border-brand bg-brand px-5 py-2 text-sm font-semibold text-[#0d2440]">{pending ? 'Creating…' : 'Create and submit for identity review'}</button></div>
    </form>
  )
}
