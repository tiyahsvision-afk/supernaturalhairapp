'use server'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import type { DocumentType } from '@prisma/client'
import { prisma } from '@/lib/db'
import { requirePermission } from '@/lib/auth/next'
import { canViewRecord } from '@/lib/permissions'
import { audit } from '@/lib/audit'
import { localStorageAdapter, newStorageKey, scanBuffer, sha256Hex, validateUpload } from '@/lib/storage'
import { reindexRawMaterial, reindexSupplier } from '@/lib/search-index'
import { upsertEdge } from '@/lib/services/graph'

export async function createRawMaterialAction(f: FormData) {
  const s = await requirePermission('rawmaterial:write', 'create raw material')
  const active = String(f.get('activePercent') ?? '').trim()
  const rm = await prisma.rawMaterial.create({ data: { tradeName: String(f.get('tradeName')).trim(), supplierId: String(f.get('supplierId') || '') || null, declaredComposition: String(f.get('composition') ?? ''), activePercent: active ? Number(active) : null, activePercentConfirmed: false, ownerOrgId: s.principal.organizationId, visibility: 'RESTRICTED' } })
  await audit(s.principal, { action: 'rawmaterial.create', entityType: 'RawMaterial', entityId: rm.id, after: rm })
  await reindexRawMaterial(rm.id)
  redirect(`/raw-materials/${rm.id}`)
}

export async function addComponentAction(f: FormData) {
  const s = await requirePermission('rawmaterial:write', 'raw material component')
  const id = String(f.get('rawMaterialId'))
  const rm = await prisma.rawMaterial.findUniqueOrThrow({ where: { id } })
  if (!canViewRecord(s.principal, rm, 'rawmaterial:read')) throw new Error('Permission denied: raw material')
  const ingredientId = String(f.get('ingredientId')).replace(/^ing:/, '')
  const num = (k: string) => (String(f.get(k) ?? '').trim() ? Number(f.get(k)) : null)
  const c = await prisma.rawMaterialComponent.upsert({ where: { rawMaterialId_ingredientId: { rawMaterialId: id, ingredientId } }, update: { percentMin: num('min'), percentMax: num('max'), role: String(f.get('role')) }, create: { rawMaterialId: id, ingredientId, percentMin: num('min'), percentMax: num('max'), role: String(f.get('role')), declaredName: String(f.get('declaredName') ?? '') || null } })
  await upsertEdge(s.principal, { fromType: 'RawMaterial', fromId: id, toType: 'Ingredient', toId: ingredientId, edgeType: 'CONTAINS', confidence: 0.6, evidenceType: 'SUPPLIER_DECLARED' })
  await audit(s.principal, { action: 'rawmaterial.component', entityType: 'RawMaterialComponent', entityId: c.id, after: c })
  revalidatePath(`/raw-materials/${id}`)
}

export async function uploadDocumentAction(_p: { error?: string; ok?: string } | undefined, f: FormData) {
  const s = await requirePermission('document:upload', 'upload document')
  const id = String(f.get('rawMaterialId'))
  const rm = await prisma.rawMaterial.findUniqueOrThrow({ where: { id } })
  if (!canViewRecord(s.principal, rm, 'rawmaterial:read')) return { error: 'Not permitted.' }
  const file = f.get('file')
  if (!(file instanceof File)) return { error: 'Choose a file.' }
  const data = Buffer.from(await file.arrayBuffer())
  const v = validateUpload(file.name, data, file.type)
  if (!v.ok) return { error: v.error }
  const scan = await scanBuffer(data)
  if (scan === 'INFECTED') return { error: 'File rejected by malware scan.' }
  const key = newStorageKey(v.ext)
  await localStorageAdapter.put(key, data)
  const doc = await prisma.document.create({ data: { ownerOrgId: rm.ownerOrgId, visibility: 'RESTRICTED', docType: String(f.get('docType')) as DocumentType, title: String(f.get('title') || file.name), filename: file.name.slice(0, 200), storageKey: key, mimeType: v.mime, sizeBytes: data.length, sha256: sha256Hex(data), version: String(f.get('version') ?? '') || null, documentDate: f.get('documentDate') ? new Date(String(f.get('documentDate'))) : null, expiresAt: f.get('expiresAt') ? new Date(String(f.get('expiresAt'))) : null, reviewDueAt: f.get('expiresAt') ? new Date(new Date(String(f.get('expiresAt'))).getTime() - 30 * 86400_000) : new Date(Date.now() + 365 * 86400_000), rawMaterialId: id, supplierId: rm.supplierId, scanStatus: scan, uploadedById: s.user.id } })
  await audit(s.principal, { action: 'document.upload', entityType: 'Document', entityId: doc.id, after: { filename: doc.filename, sha256: doc.sha256, scan } })
  revalidatePath(`/raw-materials/${id}`)
  return { ok: `Uploaded (${scan === 'CLEAN' ? 'scanned clean' : 'not scanned — no scanner configured; admin-only download'}).` }
}

export async function createSupplierAction(f: FormData) {
  const s = await requirePermission('supplier:write', 'create supplier')
  const sup = await prisma.supplier.create({ data: { name: String(f.get('name')).trim(), website: String(f.get('website') ?? '') || null, type: String(f.get('type') ?? '') || null, country: String(f.get('country') ?? '') || null } })
  await audit(s.principal, { action: 'supplier.create', entityType: 'Supplier', entityId: sup.id, after: sup })
  await reindexSupplier(sup.id)
  revalidatePath('/suppliers')
}

async function visibleMaterial(principal: Parameters<typeof canViewRecord>[0], id: string) {
  const rm = await prisma.rawMaterial.findUnique({ where: { id } })
  if (!rm || !canViewRecord(principal, rm, 'rawmaterial:read')) throw new Error('Raw material not found.')
  return rm
}

/** Records a specification value from a supplier document. It stays unverified until a person checks it. */
export async function addSpecAction(f: FormData) {
  const s = await requirePermission('rawmaterial:write', 'raw material specification')
  const rm = await visibleMaterial(s.principal, String(f.get('rawMaterialId')))
  const parameter = String(f.get('parameter') ?? '').trim(), value = String(f.get('value') ?? '').trim()
  if (!parameter || !value) throw new Error('Parameter and value are required.')
  const documentId = String(f.get('documentId') ?? '') || null
  if (documentId && !(await prisma.document.findFirst({ where: { id: documentId, rawMaterialId: rm.id } }))) throw new Error('Document not found for this material.')
  const spec = await prisma.rawMaterialSpec.create({ data: { rawMaterialId: rm.id, parameter: parameter.slice(0, 120), value: value.slice(0, 300), unit: String(f.get('unit') ?? '').trim() || null, method: String(f.get('method') ?? '').trim() || null, documentId, entryMode: 'MANUAL', createdById: s.user.id } })
  await audit(s.principal, { action: 'rawmaterial.spec.add', entityType: 'RawMaterial', entityId: rm.id, after: { specId: spec.id, parameter, value } })
  revalidatePath(`/raw-materials/${rm.id}`)
}

/** Human verification against the source document. The person who entered a value cannot verify it. */
export async function verifySpecAction(f: FormData) {
  const s = await requirePermission('rawmaterial:write', 'verify specification')
  const spec = await prisma.rawMaterialSpec.findUniqueOrThrow({ where: { id: String(f.get('specId')) } })
  await visibleMaterial(s.principal, spec.rawMaterialId)
  if (spec.createdById === s.user.id) throw new Error('A second person must verify a value you entered.')
  if (!spec.documentId) throw new Error('Link the value to its source document before verifying.')
  await prisma.rawMaterialSpec.update({ where: { id: spec.id }, data: { verifiedById: s.user.id, verifiedAt: new Date() } })
  await audit(s.principal, { action: 'rawmaterial.spec.verify', entityType: 'RawMaterial', entityId: spec.rawMaterialId, after: { specId: spec.id } })
  revalidatePath(`/raw-materials/${spec.rawMaterialId}`)
}
