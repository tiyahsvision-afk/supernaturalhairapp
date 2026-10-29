import { randomBytes } from 'node:crypto'
import { prisma } from '../db'
import { sha256 } from './session'
import type { Principal } from '../permissions'
import { securityEvent } from '../audit'

/** Creates a key. The full key is returned exactly once; only its hash is stored. */
export async function createApiKey(input: { name: string; organizationId: string; scopes: string[]; createdById?: string; expiresAt?: Date }) {
  const secret = randomBytes(24).toString('base64url')
  const prefix = `sii_${randomBytes(4).toString('hex')}`
  const key = `${prefix}_${secret}`
  const row = await prisma.apiKey.create({
    data: { name: input.name, prefix, keyHash: sha256(key), organizationId: input.organizationId, scopes: input.scopes, createdById: input.createdById, expiresAt: input.expiresAt },
  })
  return { key, id: row.id, prefix }
}

/**
 * API keys act as an organization-scoped principal with no roles beyond their scopes. Permissions are computed as
 * SUPER_ADMIN ∩ scopes, so a key can never exceed the scopes it was granted.
 */
export async function resolveApiKey(raw: string | null, ip?: string): Promise<Principal | null> {
  if (!raw) return null
  const m = /^(sii_[0-9a-f]{8})_[A-Za-z0-9_-]+$/.exec(raw)
  if (!m) return null
  const row = await prisma.apiKey.findUnique({ where: { prefix: m[1] } })
  if (!row || row.keyHash !== sha256(raw) || row.revokedAt || (row.expiresAt && row.expiresAt < new Date())) {
    await securityEvent('API_KEY_INVALID', { ip, prefix: m[1] })
    return null
  }
  await prisma.apiKey.update({ where: { id: row.id }, data: { lastUsedAt: new Date() } })
  return { id: row.id, organizationId: row.organizationId, roles: ['SUPER_ADMIN'], kind: 'API_KEY', scopes: row.scopes, label: `api-key:${row.prefix}` }
}
