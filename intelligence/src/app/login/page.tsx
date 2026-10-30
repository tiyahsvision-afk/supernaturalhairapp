import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getSession } from '@/lib/auth/next'
import { LoginForm } from './LoginForm'

export const dynamic = 'force-dynamic'

export default async function LoginPage() {
  const s = await getSession()
  if (s?.mfaVerified && !s.needsMfaEnrollment) redirect('/')
  return (
    <main className="grid min-h-screen place-items-center px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-3 h-10 w-10 rounded-full bg-brand" aria-hidden />
          <h1 className="text-2xl">Supernatural<br />Ingredient Intelligence</h1>
          <p className="mt-2 text-sm text-ink-2">Private research platform. Authorized users only.</p>
        </div>
        <div className="rounded-2xl border border-line bg-paper p-6"><LoginForm /></div>
        {process.env.ALLOW_SELF_SIGNUP === 'true' && <p className="mt-4 text-center text-sm">New here? <Link href="/signup">Create a research workspace</Link></p>}
        <p className="mt-6 text-center text-xs text-ink-3">Access is logged. Research records, private formulas and participant-level data are confidential.</p>
      </div>
    </main>
  )
}
