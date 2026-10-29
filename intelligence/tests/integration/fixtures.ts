import { randomBytes } from 'node:crypto'
import type { OrgType, Role } from '@prisma/client'
import { prisma } from '@/lib/db'
import { hashPassword } from '@/lib/auth/password'
import type { Principal } from '@/lib/permissions'

export const uid = () => randomBytes(4).toString('hex')
export const PASSWORD = 'Correct-Horse-2026!'

export async function makeOrg(type: OrgType = 'BRAND') {
  const s = uid()
  return prisma.organization.create({ data: { name: `Test org ${s}`, slug: `test-org-${s}`, type } })
}

export async function makeUser(roles: Role[], organizationId?: string) {
  const orgId = organizationId ?? (await prisma.organization.findUniqueOrThrow({ where: { slug: 'supernatural' } })).id
  const user = await prisma.user.create({ data: { email: `u-${uid()}@test.local`, name: 'Test user', passwordHash: await hashPassword(PASSWORD), organizationId: orgId, roles: { create: roles.map((role) => ({ role })) } } })
  const principal: Principal = { id: user.id, organizationId: orgId, roles, kind: 'USER', label: user.email }
  return { user, principal }
}

export async function internalOrgId() {
  return (await prisma.organization.findUniqueOrThrow({ where: { slug: 'supernatural' } })).id
}

export async function sourceId(key: string) {
  return (await prisma.source.findUniqueOrThrow({ where: { key } })).id
}

export async function ingredientBySlug(slug: string) {
  return prisma.ingredient.findUniqueOrThrow({ where: { slug } })
}
