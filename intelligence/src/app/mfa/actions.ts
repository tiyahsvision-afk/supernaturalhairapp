'use server'
import { seal, unseal } from '@/lib/crypto'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/db'
import { SESSION_COOKIE, verifySessionMfa, sha256 } from '@/lib/auth/session'
import { getSession } from '@/lib/auth/next'
import { generateTotpSecret, verifyTotp } from '@/lib/auth/totp'
import { audit } from '@/lib/audit'
import { rateLimit } from '@/lib/rate-limit'

export async function verifyMfaAction(_p: { error?: string } | undefined, form: FormData) {
  const token = (await cookies()).get(SESSION_COOKIE)?.value
  if (!token) redirect('/login')
  if (!rateLimit(`mfa:${sha256(token)}`, 6, 0.05).ok) return { error: 'Too many attempts. Sign in again later.' }
  const ok = await verifySessionMfa(token, String(form.get('code') ?? '').trim())
  if (!ok) return { error: 'That code is not valid.' }
  redirect('/')
}

export async function startEnrollmentAction() {
  const s = await getSession()
  if (!s) redirect('/login')
  const u = await prisma.user.findUniqueOrThrow({ where: { id: s.user.id } })
  if (!u.mfaEnabled) await prisma.user.update({ where: { id: u.id }, data: { mfaSecret: seal(generateTotpSecret()) } })
  redirect('/mfa?enroll=1')
}

export async function confirmEnrollmentAction(_p: { error?: string } | undefined, form: FormData) {
  const s = await getSession()
  if (!s) redirect('/login')
  const u = await prisma.user.findUniqueOrThrow({ where: { id: s.user.id } })
  if (!u.mfaSecret || !verifyTotp(unseal(u.mfaSecret), String(form.get('code') ?? '').trim())) return { error: 'That code is not valid. Check your authenticator app and try again.' }
  await prisma.user.update({ where: { id: u.id }, data: { mfaEnabled: true } })
  await prisma.session.update({ where: { id: s.sessionId }, data: { mfaVerified: true } })
  await audit(s.principal, { action: 'user.mfa.enable', entityType: 'User', entityId: u.id })
  redirect('/')
}
