'use server'
import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/db'
import { requirePermission } from '@/lib/auth/next'

export async function saveSearchAction(f: FormData) {
  const s = await requirePermission('search:read')
  const q = String(f.get('q') ?? '').trim()
  if (!q) return
  await prisma.savedSearch.create({ data: { userId: s.user.id, name: String(f.get('name') || q).slice(0, 80), query: q, filters: { type: String(f.get('type') ?? '') || undefined } } })
  revalidatePath('/search')
}
