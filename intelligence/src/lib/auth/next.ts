import { cookies, headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { cache } from 'react'
import { resolveSession, SESSION_COOKIE, type SessionUser } from './session'
import { can, type Permission } from '../permissions'
import { securityEvent } from '../audit'

export const getSession = cache(async (): Promise<SessionUser | null> => {
  const store = await cookies()
  return resolveSession(store.get(SESSION_COOKIE)?.value)
})

/** For pages and server actions: redirects to login / MFA as needed. */
export async function requireUser(): Promise<SessionUser> {
  const s = await getSession()
  if (!s) redirect('/login')
  if (!s.mfaVerified) redirect('/mfa')
  if (s.needsMfaEnrollment) redirect('/mfa?enroll=1')
  return s
}

/** Returns true if allowed; otherwise logs a PERMISSION_DENIED security event and returns false. */
export async function allowed(s: SessionUser, perm: Permission, context?: string): Promise<boolean> {
  if (can(s.principal, perm)) return true
  const h = await headers()
  await securityEvent('PERMISSION_DENIED', { userId: s.user.id, ip: h.get('x-forwarded-for') ?? undefined, permission: perm, context })
  return false
}

/** For server actions: throws if not permitted. */
export async function requirePermission(perm: Permission, context?: string): Promise<SessionUser> {
  const s = await requireUser()
  if (!(await allowed(s, perm, context))) throw new Error(`Permission denied: ${perm}`)
  return s
}

export async function setSessionCookie(token: string) {
  const store = await cookies()
  store.set(SESSION_COOKIE, token, {
    httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', path: '/',
    maxAge: Number(process.env.SESSION_TTL_HOURS ?? 12) * 3600,
  })
}

export async function clientMeta() {
  const h = await headers()
  return { ip: h.get('x-forwarded-for')?.split(',')[0]?.trim() ?? undefined, userAgent: h.get('user-agent') ?? undefined }
}
