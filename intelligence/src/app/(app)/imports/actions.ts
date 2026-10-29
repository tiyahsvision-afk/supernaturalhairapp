'use server'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { requirePermission } from '@/lib/auth/next'
import { createImportJob, startImportInBackground } from '@/lib/import/engine'
import { prisma } from '@/lib/db'

export async function uploadImportAction(_p: { error?: string } | undefined, f: FormData) {
  const s = await requirePermission('import:run', 'import upload')
  const file = f.get('file')
  if (!(file instanceof File) || file.size === 0) return { error: 'Choose a CSV or JSON file.' }
  if (file.size > 20 * 1024 * 1024) return { error: 'File exceeds 20 MB; split it.' }
  const name = file.name.toLowerCase()
  const kind = name.endsWith('.csv') ? 'CSV' : name.endsWith('.json') ? 'JSON' : null
  if (!kind) return { error: 'Only .csv and .json files are accepted.' }
  const source = await prisma.source.findUnique({ where: { id: String(f.get('sourceId')) } })
  if (!source) return { error: 'Choose a source.' }
  let jobId: string
  try {
    const job = await createImportJob(s.principal, { sourceId: source.id, kind, entityType: String(f.get('entityType')), filename: file.name, content: await file.text(), sourceVersion: String(f.get('sourceVersion') ?? '') || undefined })
    jobId = job.id
  } catch (e) { return { error: (e as Error).message } }
  startImportInBackground(jobId, s.principal)
  redirect(`/imports/${jobId}`)
}

export async function resumeImportAction(f: FormData) {
  const s = await requirePermission('import:run', 'import resume')
  const id = String(f.get('jobId'))
  await prisma.importJob.update({ where: { id }, data: { status: 'QUEUED' } })
  startImportInBackground(id, s.principal)
  revalidatePath(`/imports/${id}`)
}
