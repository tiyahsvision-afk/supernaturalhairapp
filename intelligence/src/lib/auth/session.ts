import { unseal } from '../crypto'
import { createHash, randomBytes } from 'node:crypto'
import type { Role } from '@prisma/client'
import { prisma } from '../db'
import { PRIVILEGED_ROLES, type Principal } from '../permissions'
import { verifyPassword } from './password'
import { verifyTotp } from './totp'
import { securityEvent } from '../audit'

export const SESSION_COOKIE = 'sii_session'
const MAX_FAILED = 5
const LOCK_MINUTES = 15

export function sha256(s: string): string {
  return createHash('sha256').update(s).digest('hex')
}

export function sessionTtlMs(): number {
  return Number(process.env.SESSION_TTL_HOURS ?? 12) * 3600_000
}

export function mfaRequiredFor(roles: Role[]): boolean {
  if ((process.env.MFA_ENFORCEMENT ?? 'required') !== 'required') return false
  return roles.some((r) => PRIVILEGED_ROLES.includes(r))
}

export type LoginResult =
  | { ok: true; token: string; needsMfa: boolean; needsMfaEnrollment: boolean }
  | { ok: false; error: string }

/** Password step. Generic error messages avoid account enumeration; lockout after repeated failures. */
export async function login(email: string, password: string, meta: { ip?: string; userAgent?: string } = {}): Promise<LoginResult> {
  const user = await prisma.user.findUnique({ where: { email: email.toLowerCase().trim() }, include: { roles: true } })
  const generic = { ok: false as const, error: 'Invalid email or password.' }
  if (!user) {
    await securityEvent('LOGIN_FAILED', { email, ip: meta.ip, reason: 'unknown_user' })
    return generic
  }
  if (user.status === 'DISABLED') {
    await securityEvent('LOGIN_FAILED', { userId: user.id, ip: meta.ip, reason: 'disabled' })
    return generic
  }
  if (user.lockedUntil && user.lockedUntil > new Date()) {
    await securityEvent('LOGIN_LOCKED', { userId: user.id, ip: meta.ip })
    return { ok: false, error: 'Account temporarily locked after repeated failed sign-ins. Try again later.' }
  }
  const valid = await verifyPassword(user.passwordHash, password)
  if (!valid) {
    const failed = user.failedLoginCount + 1
    const lock = failed >= MAX_FAILED
    await prisma.user.update({
      where: { id: user.id },
      data: { failedLoginCount: lock ? 0 : failed, lockedUntil: lock ? new Date(Date.now() + LOCK_MINUTES * 60_000) : null },
    })
    await securityEvent(lock ? 'LOGIN_LOCKED' : 'LOGIN_FAILED', { userId: user.id, ip: meta.ip, failed })
    return generic
  }
  await prisma.user.update({ where: { id: user.id }, data: { failedLoginCount: 0, lockedUntil: null, lastLoginAt: new Date() } })
  const roles = user.roles.map((r) => r.role)
  const needsMfa = user.mfaEnabled
  const needsMfaEnrollment = !user.mfaEnabled && mfaRequiredFor(roles)
  const token = randomBytes(32).toString('base64url')
  await prisma.session.create({
    data: {
      id: sha256(token),
      userId: user.id,
      expiresAt: new Date(Date.now() + sessionTtlMs()),
      mfaVerified: !needsMfa,
      ip: meta.ip,
      userAgent: meta.userAgent?.slice(0, 300),
    },
  })
  await securityEvent('LOGIN_OK', { userId: user.id, ip: meta.ip, needsMfa })
  return { ok: true, token, needsMfa, needsMfaEnrollment }
}

export async function verifySessionMfa(token: string, code: string): Promise<boolean> {
  const session = await prisma.session.findUnique({ where: { id: sha256(token) }, include: { user: true } })
  if (!session || session.revokedAt || session.expiresAt < new Date() || !session.user.mfaSecret) return false
  if (!verifyTotp(unseal(session.user.mfaSecret), code)) {
    await securityEvent('MFA_FAILED', { userId: session.userId })
    return false
  }
  await prisma.session.update({ where: { id: session.id }, data: { mfaVerified: true } })
  return true
}

export interface SessionUser {
  principal: Principal
  user: { id: string; email: string; name: string; mfaEnabled: boolean; organizationId: string; organizationName: string }
  sessionId: string
  mfaVerified: boolean
  needsMfaEnrollment: boolean
}

export async function resolveSession(token: string | undefined | null): Promise<SessionUser | null> {
  if (!token) return null
  const session = await prisma.session.findUnique({
    where: { id: sha256(token) },
    include: { user: { include: { roles: true, organization: true } } },
  })
  if (!session || session.revokedAt || session.expiresAt < new Date()) return null
  const u = session.user
  if (u.status !== 'ACTIVE') return null
  const roles = u.roles.map((r) => r.role)
  // Sliding expiry, written at most once per minute.
  if (Date.now() - session.lastSeenAt.getTime() > 60_000) {
    await prisma.session.update({
      where: { id: session.id },
      data: { lastSeenAt: new Date(), expiresAt: new Date(Date.now() + sessionTtlMs()) },
    })
  }
  return {
    principal: { id: u.id, organizationId: u.organizationId, roles, kind: 'USER', label: u.email },
    user: { id: u.id, email: u.email, name: u.name, mfaEnabled: u.mfaEnabled, organizationId: u.organizationId, organizationName: u.organization.name },
    sessionId: session.id,
    mfaVerified: session.mfaVerified,
    needsMfaEnrollment: !u.mfaEnabled && mfaRequiredFor(roles),
  }
}

export async function revokeSession(token: string) {
  await prisma.session.updateMany({ where: { id: sha256(token) }, data: { revokedAt: new Date() } })
}
