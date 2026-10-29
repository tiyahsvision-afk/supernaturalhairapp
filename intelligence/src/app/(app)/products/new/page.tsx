import { allowed, requireUser } from '@/lib/auth/next'
import { PageHeader, PermissionDenied, Notice } from '@/components/ui'
import { NewProductForm } from './Form'

export default async function NewProduct() {
  const s = await requireUser()
  if (!(await allowed(s, 'product:write', '/products/new'))) return <PermissionDenied permission="product:write" />
  return (
    <>
      <PageHeader eyebrow="Products" title="Add product" subtitle="Paste the ingredient list exactly as displayed. The parser keeps order, removes footnotes, and routes uncertain identities to review instead of guessing." />
      <Notice>Label-photo OCR and barcode lookup are Phase 2. For now, paste the list from the label or the manufacturer’s page and record the source.</Notice>
      <NewProductForm />
    </>
  )
}
