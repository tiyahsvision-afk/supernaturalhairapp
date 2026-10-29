import { hash, verify } from '@node-rs/argon2'

// argon2id with OWASP-recommended baseline parameters.
const OPTIONS = { memoryCost: 19456, timeCost: 2, parallelism: 1 }

const COMMON = new Set(['password1234', '123456789012', 'qwertyuiop12', 'letmein12345', 'supernatural1', 'administrator'])

export function passwordPolicyErrors(pw: string): string[] {
  const errors: string[] = []
  if (pw.length < 12) errors.push('Password must be at least 12 characters.')
  if (pw.length > 256) errors.push('Password must be at most 256 characters.')
  if (COMMON.has(pw.toLowerCase())) errors.push('Password is too common.')
  const classes = [/[a-z]/, /[A-Z]/, /\d/, /[^A-Za-z0-9]/].filter((r) => r.test(pw)).length
  if (classes < 3) errors.push('Use at least three of: lowercase, uppercase, digits, symbols.')
  return errors
}

export function hashPassword(pw: string): Promise<string> {
  return hash(pw, OPTIONS)
}

export async function verifyPassword(hashed: string, pw: string): Promise<boolean> {
  try {
    return await verify(hashed, pw)
  } catch {
    return false
  }
}
