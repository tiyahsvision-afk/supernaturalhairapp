'use server'
import { redirect } from 'next/navigation'
import { login } from '@/lib/auth/session'
import { clientMeta, setSessionCookie } from '@/lib/auth/next'
import { rateLimit } from '@/lib/rate-limit'

export async function loginAction(_prev: { error?: string } | undefined, form: FormData): Promise<{ error?: string }> {
  const meta = await clientMeta()
  const rl = rateLimit(`login:${meta.ip ?? 'unknown'}`, 10, 0.1)
  if (!rl.ok) return { error: `Too many sign-in attempts. Try again in ${rl.retryAfterSeconds}s.` }
  const email = String(form.get('email') ?? '')
  const password = String(form.get('password') ?? '')
  if (!email || !password) return { error: 'Enter your email and password.' }
  const res = await login(email, password, meta)
  if (!res.ok) return { error: res.error }
  await setSessionCookie(res.token)
  redirect(res.needsMfa ? '/mfa' : res.needsMfaEnrollment ? '/mfa?enroll=1' : '/')
}
