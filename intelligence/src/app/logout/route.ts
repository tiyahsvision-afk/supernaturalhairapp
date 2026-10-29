import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { revokeSession, SESSION_COOKIE } from '@/lib/auth/session'

export async function POST(req: Request) {
  const store = await cookies()
  const token = store.get(SESSION_COOKIE)?.value
  if (token) await revokeSession(token)
  store.delete(SESSION_COOKIE)
  return NextResponse.redirect(new URL('/login', req.url), { status: 303 })
}
