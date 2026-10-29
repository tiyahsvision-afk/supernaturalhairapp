'use client'
import { useActionState } from 'react'
import { uploadImportAction } from './actions'

export function UploadForm({ sources }: { sources: { id: string; name: string; rights: string }[] }) {
  const [state, action, pending] = useActionState(uploadImportAction, undefined)
  return (
    <form action={action} className="grid gap-2 sm:grid-cols-4">
      <select name="entityType"><option value="ingredient">Ingredients</option><option value="product">Products</option><option value="evidence">Evidence</option><option value="patent">Patents</option><option value="regulatory">Regulatory records</option><option value="fact">Property facts</option></select>
      <select name="sourceId" required className="sm:col-span-2">{sources.map((s) => <option key={s.id} value={s.id}>{s.name} — {s.rights.toLowerCase().replace(/_/g, ' ')}</option>)}</select>
      <input name="sourceVersion" placeholder="Source version / release" />
      <input type="file" name="file" accept=".csv,.json" required className="sm:col-span-3" />
      <button disabled={pending} className="rounded-full border border-brand bg-brand px-4 py-1.5 text-sm font-medium text-[#0d2440]">{pending ? 'Uploading…' : 'Start import'}</button>
      {state?.error && <p role="alert" className="text-sm text-bad sm:col-span-4">{state.error}</p>}
    </form>
  )
}
