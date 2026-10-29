import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getSession } from '@/lib/auth/next'
import { can, canViewRecord } from '@/lib/permissions'
import { localStorageAdapter, verifyDownload } from '@/lib/storage'
import { audit, securityEvent } from '@/lib/audit'

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const url = new URL(req.url)
  const s = await getSession()
  if (!s || !s.mfaVerified) return NextResponse.json({ error: { code: 'UNAUTHENTICATED', message: 'Sign in required.' } }, { status: 401 })
  if (!verifyDownload(id, url.searchParams.get('exp'), url.searchParams.get('sig'))) return NextResponse.json({ error: { code: 'INVALID_SIGNATURE', message: 'Link expired or invalid.' } }, { status: 403 })
  const doc = await prisma.document.findUnique({ where: { id } })
  if (!doc || !can(s.principal, 'document:read') || !canViewRecord(s.principal, doc, 'document:read')) {
    await securityEvent('PERMISSION_DENIED', { userId: s.user.id, permission: 'document:read', documentId: id })
    return NextResponse.json({ error: { code: 'NOT_FOUND', message: 'Document not found.' } }, { status: 404 })
  }
  if (doc.scanStatus === 'INFECTED') return NextResponse.json({ error: { code: 'BLOCKED', message: 'File failed malware scanning.' } }, { status: 423 })
  if (doc.scanStatus !== 'CLEAN' && !can(s.principal, 'source:manage')) return NextResponse.json({ error: { code: 'NOT_SCANNED', message: 'File has not been malware-scanned; only administrators may download it.' } }, { status: 423 })
  const data = await localStorageAdapter.get(doc.storageKey)
  await audit(s.principal, { action: 'document.download', entityType: 'Document', entityId: doc.id })
  return new NextResponse(new Uint8Array(data), { headers: { 'Content-Type': doc.mimeType, 'Content-Disposition': `attachment; filename="${doc.filename.replace(/[^\w.\- ]/g, '_')}"`, 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff' } })
}
