'use server'
import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/db'
import { requireUser } from '@/lib/auth/next'
import { MODES } from '@/lib/workspace'

export async function setWorkspaceModeAction(f: FormData) {
  const s = await requireUser()
  const mode = String(f.get('mode') ?? '')
  if (!(mode in MODES)) return
  await prisma.user.update({ where: { id: s.user.id }, data: { workspaceMode: mode } })
  revalidatePath('/')
}
