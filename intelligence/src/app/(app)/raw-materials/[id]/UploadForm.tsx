'use client'
import { useActionState } from 'react'
import { uploadDocumentAction } from '../actions'

export function UploadForm({ rawMaterialId }: { rawMaterialId: string }) {
  const [state, action, pending] = useActionState(uploadDocumentAction, undefined)
  return (
    <form action={action} className="mt-4 grid gap-2 border-t border-line pt-4 sm:grid-cols-3">
      <input type="hidden" name="rawMaterialId" value={rawMaterialId} />
      <input type="file" name="file" accept=".pdf,.png,.jpg,.jpeg,.csv,.txt" required className="sm:col-span-2" />
      <select name="docType"><option>SDS</option><option>TDS</option><option>COA</option><option>SPECIFICATION</option><option>FORMULATION_GUIDE</option><option>REGULATORY</option><option>OTHER</option></select>
      <input name="title" placeholder="Title" /><input name="version" placeholder="Document version" />
      <label className="text-xs">Document date<input type="date" name="documentDate" /></label>
      <label className="text-xs">Expires / re-review by<input type="date" name="expiresAt" /></label>
      <button disabled={pending} className="rounded-full border border-line px-4 py-1.5 text-sm">{pending ? 'Uploading…' : 'Upload (validated, hashed, scanned)'}</button>
      {state?.error && <p role="alert" className="text-sm text-bad sm:col-span-3">{state.error}</p>}
      {state?.ok && <p className="text-sm text-good sm:col-span-3">{state.ok}</p>}
    </form>
  )
}
