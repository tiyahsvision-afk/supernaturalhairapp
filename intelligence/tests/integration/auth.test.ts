import { describe, expect, it } from 'vitest'
import { prisma } from '@/lib/db'
import { login, resolveSession, revokeSession, verifySessionMfa } from '@/lib/auth/session'
import { createApiKey, resolveApiKey } from '@/lib/auth/api-keys'
import { generateTotpSecret, totp } from '@/lib/auth/totp'
import { seal } from '@/lib/crypto'
import { can } from '@/lib/permissions'
import { makeUser, PASSWORD, internalOrgId } from './fixtures'

describe('authentication', () => {
  it('rejects unknown users and wrong passwords with the same generic message', async () => {
    const { user } = await makeUser(['READ_ONLY_RESEARCHER'])
    const a = await login('nobody-here@test.local', PASSWORD)
    const b = await login(user.email, 'wrong-password')
    expect(a).toEqual({ ok: false, error: 'Invalid email or password.' })
    expect(b).toEqual(a)
  })

  it('locks the account after five failed attempts, even for the correct password', async () => {
    const { user } = await makeUser(['READ_ONLY_RESEARCHER'])
    for (let i = 0; i < 5; i++) await login(user.email, 'wrong-password')
    const r = await login(user.email, PASSWORD)
    expect(r.ok).toBe(false)
    expect(!r.ok && r.error).toMatch(/locked/i)
    expect(await prisma.securityEvent.count({ where: { userId: user.id, type: 'LOGIN_LOCKED' } })).toBeGreaterThan(0)
  })

  it('requires MFA enrolment for privileged roles, not for read-only researchers', async () => {
    const priv = await makeUser(['COSMETIC_CHEMIST'])
    const plain = await makeUser(['READ_ONLY_RESEARCHER'])
    const p = await login(priv.user.email, PASSWORD)
    const q = await login(plain.user.email, PASSWORD)
    expect(p.ok && p.needsMfaEnrollment).toBe(true)
    expect(q.ok && q.needsMfaEnrollment).toBe(false)
    const s = await resolveSession(p.ok ? p.token : null)
    expect(s?.needsMfaEnrollment).toBe(true)
  })

  it('verifies TOTP for enrolled users; the session is unverified until then', async () => {
    const { user } = await makeUser(['DATA_ADMIN'])
    const secret = generateTotpSecret()
    await prisma.user.update({ where: { id: user.id }, data: { mfaEnabled: true, mfaSecret: seal(secret) } })
    const r = await login(user.email, PASSWORD)
    if (!r.ok) throw new Error('login failed')
    expect(r.needsMfa).toBe(true)
    expect((await resolveSession(r.token))?.mfaVerified).toBe(false)
    const wrong = String((Number(totp(secret)) + 1) % 1_000_000).padStart(6, '0')
    expect(await verifySessionMfa(r.token, wrong)).toBe(false)
    expect(await verifySessionMfa(r.token, totp(secret))).toBe(true)
    expect((await resolveSession(r.token))?.mfaVerified).toBe(true)
  })

  it('stores TOTP secrets encrypted, never in plaintext', async () => {
    const enrolled = await prisma.user.findMany({ where: { mfaSecret: { not: null } }, select: { mfaSecret: true } })
    for (const u of enrolled) expect(u.mfaSecret!.startsWith('enc1:')).toBe(true)
  })

  it('revoked sessions no longer resolve', async () => {
    const { user } = await makeUser(['READ_ONLY_RESEARCHER'])
    const r = await login(user.email, PASSWORD)
    if (!r.ok) throw new Error('login failed')
    expect(await resolveSession(r.token)).not.toBeNull()
    await revokeSession(r.token)
    expect(await resolveSession(r.token)).toBeNull()
  })

  it('stores sessions and API keys only as hashes', async () => {
    const { user } = await makeUser(['READ_ONLY_RESEARCHER'])
    const r = await login(user.email, PASSWORD)
    if (!r.ok) throw new Error('login failed')
    expect(await prisma.session.findUnique({ where: { id: r.token } })).toBeNull()
    const k = await createApiKey({ name: 't', organizationId: await internalOrgId(), scopes: ['search:read'] })
    const row = await prisma.apiKey.findUniqueOrThrow({ where: { id: k.id } })
    expect(row.keyHash).not.toContain(k.key.split('_')[2])
  })

  it('API keys are limited to their scopes and stop working when revoked or expired', async () => {
    const orgId = await internalOrgId()
    const k = await createApiKey({ name: 't', organizationId: orgId, scopes: ['ingredient:read'] })
    const p = await resolveApiKey(k.key)
    expect(p && can(p, 'ingredient:read')).toBe(true)
    expect(p && can(p, 'ingredient:write')).toBe(false)
    expect(p && can(p, 'user:manage')).toBe(false)
    expect(await resolveApiKey(k.key.slice(0, -2) + 'xx')).toBeNull()
    await prisma.apiKey.update({ where: { id: k.id }, data: { revokedAt: new Date() } })
    expect(await resolveApiKey(k.key)).toBeNull()
    const e = await createApiKey({ name: 't2', organizationId: orgId, scopes: ['ingredient:read'], expiresAt: new Date(Date.now() - 1000) })
    expect(await resolveApiKey(e.key)).toBeNull()
  })
})
