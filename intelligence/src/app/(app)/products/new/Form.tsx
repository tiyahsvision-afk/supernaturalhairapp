'use client'
import Link from 'next/link'
import { useActionState } from 'react'
import { createProductAction } from '../actions'

export function NewProductForm() {
  const [state, action, pending] = useActionState(createProductAction, undefined)
  return (
    <form action={action} className="grid max-w-3xl gap-3 sm:grid-cols-2">
      <label className="text-sm"><span className="mb-1 block font-medium">Brand *</span><input name="brand" required /></label>
      <label className="text-sm"><span className="mb-1 block font-medium">Product name *</span><input name="name" required /></label>
      <label className="text-sm"><span className="mb-1 block font-medium">Category</span><input name="category" /></label>
      <label className="text-sm"><span className="mb-1 block font-medium">Application</span><select name="applicationType"><option>RINSE_OFF</option><option>LEAVE_ON</option><option>UNKNOWN</option></select></label>
      <label className="text-sm"><span className="mb-1 block font-medium">Barcode (GTIN)</span><input name="barcode" inputMode="numeric" /></label>
      <label className="text-sm"><span className="mb-1 block font-medium">Market</span><input name="market" placeholder="US" /></label>
      <label className="text-sm sm:col-span-2"><span className="mb-1 block font-medium">Source URL</span><input name="url" type="url" /></label>
      <label className="text-sm"><span className="mb-1 block font-medium">List source</span><select name="listSource"><option value="MANUFACTURER_WEBSITE">Manufacturer website</option><option value="LABEL_PHOTO">Physical label (transcribed)</option><option value="RETAILER">Retailer page</option><option value="USER_SUBMITTED">User submitted</option></select></label>
      <label className="text-sm"><span className="mb-1 block font-medium">Source registry entry</span><select name="sourceKey"><option value="manufacturer-labels">Manufacturer product pages</option><option value="shcbeauty">Supernatural (shcbeauty.com)</option></select></label>
      <label className="text-sm sm:col-span-2"><span className="mb-1 block font-medium">Ingredient list (as displayed) *</span><textarea name="ingredientList" rows={6} required /></label>
      <label className="inline-flex items-center gap-2 text-sm sm:col-span-2"><input type="checkbox" name="confirmNotDuplicate" value="1" /> I checked: this is not a duplicate of an existing product</label>
      {state?.error && <p role="alert" className="text-sm text-bad sm:col-span-2">{state.error} {state.duplicateId && <Link href={`/products/${state.duplicateId}`}>Open existing product</Link>}</p>}
      <div><button disabled={pending} className="rounded-full border border-brand bg-brand px-5 py-2 text-sm font-semibold text-[#0d2440]">{pending ? 'Parsing…' : 'Save and parse'}</button></div>
    </form>
  )
}
