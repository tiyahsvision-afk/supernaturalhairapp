'use server'
import { randomBytes } from 'node:crypto'
import { redirect } from 'next/navigation'
import type { OrgType } from '@prisma/client'
import { prisma } from '@/lib/db'
import { audit } from '@/lib/audit'
import { hashPassword, passwordPolicyErrors } from '@/lib/auth/password'
import { login } from '@/lib/auth/session'
import { clientMeta, setSessionCookie } from '@/lib/auth/next'
import { rateLimit } from '@/lib/rate-limit'
import { slugify } from '@/lib/normalize'
import { MODES } from '@/lib/workspace'

export const signupEnabled = async () => process.env.ALLOW_SELF_SIGNUP === 'true'

const ORG_TYPE: Record<string, OrgType> = { FOUNDER: 'BRAND', BRAND: 'BRAND', MANUFACTURER: 'BRAND', CHEMIST: 'RESEARCH' }

/** Self-service onboarding: a new, isolated organization on the trial plan with one brand-partner user. */
export async function signupAction(_p: { error?: string } | undefined, f: FormData): Promise<{ error?: string } | undefined> {
  if (!(await signupEnabled())) return { error: 'Accounts are created by invitation.' }
  const meta = await clientMeta()
  const rl = rateLimit(`signup:${meta.ip ?? 'unknown'}`, 5, 0.01)
  if (!rl.ok) return { error: 'Too many sign-up attempts. Try again later.' }
  const name = String(f.get('name') ?? '').trim().slice(0, 120)
  const email = String(f.get('email') ?? '').trim().toLowerCase()
  const password = String(f.get('password') ?? '')
  const orgName = String(f.get('organization') ?? '').trim().slice(0, 120)
  const mode = String(f.get('mode') ?? 'FOUNDER')
  if (!name || !orgName || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return { error: 'Enter your name, a valid email and your organization name.' }
  if (!(mode in MODES)) return { error: 'Choose how you will use the platform.' }
  const policy = passwordPolicyErrors(password)
  if (policy.length) return { error: policy.join(' ') }
  if (f.get('terms') !== 'on') return { error: 'Please confirm you understand the platform provides research decision support only.' }
  // Same message whether or not the email exists, so the form cannot be used to discover accounts.
  if (await prisma.user.findUnique({ where: { email } })) return { error: 'An account could not be created with these details. If you already have one, sign in.' }
  const org = await prisma.organization.create({ data: { name: orgName, slug: `${slugify(orgName).slice(0, 40) || 'org'}-${randomBytes(3).toString('hex')}`, type: ORG_TYPE[mode], entitlements: { plan: 'trial', createdVia: 'self-signup' } } })
  const user = await prisma.user.create({ data: { email, name, passwordHash: await hashPassword(password), organizationId: org.id, workspaceMode: mode, roles: { create: [{ role: 'BRAND_PARTNER' }] } } })
  await audit({ id: user.id, organizationId: org.id, roles: ['BRAND_PARTNER'], kind: 'USER', label: email }, { action: 'org.self_signup', entityType: 'Organization', entityId: org.id, after: { mode, plan: 'trial' } })
  const res = await login(email, password, meta)
  if (!res.ok) redirect('/login')
  await setSessionCookie(res.token)
  redirect(mode === 'FOUNDER' ? '/founder' : '/')
}
