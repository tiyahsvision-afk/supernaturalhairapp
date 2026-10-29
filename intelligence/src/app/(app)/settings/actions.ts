'use server'
import { revalidatePath } from 'next/cache'
import type { Role } from '@prisma/client'
import { prisma } from '@/lib/db'
import { requirePermission, requireUser } from '@/lib/auth/next'
import { hashPassword, passwordPolicyErrors, verifyPassword } from '@/lib/auth/password'
import { createApiKey } from '@/lib/auth/api-keys'
import { PERMISSIONS } from '@/lib/permissions'
import { audit } from '@/lib/audit'

export async function createUserAction(_p: { error?: string; ok?: string } | undefined, f: FormData) {
  const s = await requirePermission('user:manage', 'create user')
  const pw = String(f.get('password') ?? '')
  const errors = passwordPolicyErrors(pw)
  if (errors.length) return { error: errors.join(' ') }
  const roles = f.getAll('roles').map(String) as Role[]
  if (!roles.length) return { error: 'Choose at least one role.' }
  if (roles.includes('SUPER_ADMIN') && !s.principal.roles.includes('SUPER_ADMIN')) return { error: 'Only a super admin can grant super admin.' }
  try {
    const u = await prisma.user.create({ data: { email: String(f.get('email')).toLowerCase().trim(), name: String(f.get('name')).trim(), passwordHash: await hashPassword(pw), organizationId: String(f.get('organizationId') || s.user.organizationId), roles: { create: roles.map((role) => ({ role })) } } })
    await audit(s.principal, { action: 'user.create', entityType: 'User', entityId: u.id, after: { email: u.email, roles } })
  } catch (e) { if ((e as { code?: string }).code === 'P2002') return { error: 'Email already in use.' }; throw e }
  revalidatePath('/settings')
  return { ok: 'User created. Privileged roles must enroll in two-factor authentication at first sign-in.' }
}

export async function setRolesAction(f: FormData) {
  const s = await requirePermission('user:manage', 'set roles')
  const userId = String(f.get('userId'))
  const roles = f.getAll('roles').map(String) as Role[]
  if (roles.includes('SUPER_ADMIN') && !s.principal.roles.includes('SUPER_ADMIN')) throw new Error('Permission denied: only a super admin can grant super admin.')
  if (userId === s.user.id && !roles.includes('SUPER_ADMIN') && s.principal.roles.includes('SUPER_ADMIN')) throw new Error('You cannot remove your own super admin role.')
  const before = await prisma.userRole.findMany({ where: { userId } })
  await prisma.$transaction([prisma.userRole.deleteMany({ where: { userId } }), prisma.userRole.createMany({ data: roles.map((role) => ({ userId, role })) }), prisma.session.updateMany({ where: { userId, revokedAt: null }, data: { revokedAt: new Date() } })])
  await audit(s.principal, { action: 'user.roles', entityType: 'User', entityId: userId, before: before.map((r) => r.role), after: roles, reason: 'Role change (sessions revoked)' })
  revalidatePath('/settings')
}

export async function setUserStatusAction(f: FormData) {
  const s = await requirePermission('user:manage', 'user status')
  const userId = String(f.get('userId')), status = String(f.get('status')) as 'ACTIVE' | 'DISABLED'
  if (userId === s.user.id) throw new Error('You cannot disable your own account.')
  await prisma.user.update({ where: { id: userId }, data: { status, failedLoginCount: 0, lockedUntil: null } })
  if (status === 'DISABLED') await prisma.session.updateMany({ where: { userId }, data: { revokedAt: new Date() } })
  await audit(s.principal, { action: 'user.status', entityType: 'User', entityId: userId, after: { status } })
  revalidatePath('/settings')
}

export async function createApiKeyAction(_p: { error?: string; key?: string } | undefined, f: FormData) {
  const s = await requirePermission('apikey:manage', 'create api key')
  const scopes = f.getAll('scopes').map(String).filter((x) => (PERMISSIONS as readonly string[]).includes(x))
  if (!scopes.length) return { error: 'Choose at least one scope.' }
  const days = Number(f.get('days') ?? 90)
  const res = await createApiKey({ name: String(f.get('name')).trim(), organizationId: s.user.organizationId, scopes, createdById: s.user.id, expiresAt: new Date(Date.now() + days * 86400_000) })
  await audit(s.principal, { action: 'apikey.create', entityType: 'ApiKey', entityId: res.id, after: { prefix: res.prefix, scopes, days } })
  revalidatePath('/settings')
  return { key: res.key }
}

export async function revokeApiKeyAction(f: FormData) {
  const s = await requirePermission('apikey:manage', 'revoke api key')
  const id = String(f.get('id'))
  await prisma.apiKey.update({ where: { id, organizationId: s.user.organizationId }, data: { revokedAt: new Date() } })
  await audit(s.principal, { action: 'apikey.revoke', entityType: 'ApiKey', entityId: id })
  revalidatePath('/settings')
}

export async function changePasswordAction(_p: { error?: string; ok?: string } | undefined, f: FormData) {
  const s = await requireUser()
  const u = await prisma.user.findUniqueOrThrow({ where: { id: s.user.id } })
  if (!(await verifyPassword(u.passwordHash, String(f.get('current') ?? '')))) return { error: 'Current password is incorrect.' }
  const pw = String(f.get('next') ?? '')
  const errors = passwordPolicyErrors(pw)
  if (errors.length) return { error: errors.join(' ') }
  await prisma.user.update({ where: { id: u.id }, data: { passwordHash: await hashPassword(pw) } })
  await prisma.session.updateMany({ where: { userId: u.id, id: { not: s.sessionId } }, data: { revokedAt: new Date() } })
  await audit(s.principal, { action: 'user.password.change', entityType: 'User', entityId: u.id })
  return { ok: 'Password changed. Other sessions were signed out.' }
}
