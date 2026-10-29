import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto'

// Field-level encryption for secrets stored in the database (e.g. TOTP seeds). AES-256-GCM with a key derived from
// APP_SECRET; rotating APP_SECRET therefore requires users to re-enrol MFA (documented in docs/security.md).
const PREFIX = 'enc1:'

function key(): Buffer {
  const secret = process.env.APP_SECRET
  if (!secret || secret.length < 32) throw new Error('APP_SECRET must be set (at least 32 characters).')
  return createHash('sha256').update(`sii-field-encryption:${secret}`).digest()
}

export function seal(plain: string): string {
  const iv = randomBytes(12)
  const c = createCipheriv('aes-256-gcm', key(), iv)
  const body = Buffer.concat([c.update(plain, 'utf8'), c.final()])
  return PREFIX + Buffer.concat([iv, c.getAuthTag(), body]).toString('base64url')
}

export function unseal(stored: string): string {
  if (!stored.startsWith(PREFIX)) throw new Error('Value is not sealed.')
  const raw = Buffer.from(stored.slice(PREFIX.length), 'base64url')
  const d = createDecipheriv('aes-256-gcm', key(), raw.subarray(0, 12))
  d.setAuthTag(raw.subarray(12, 28))
  return Buffer.concat([d.update(raw.subarray(28)), d.final()]).toString('utf8')
}
