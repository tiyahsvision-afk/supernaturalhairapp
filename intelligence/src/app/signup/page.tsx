import Link from 'next/link'
import { signupEnabled } from './actions'
import { SignupForm } from './SignupForm'

export const dynamic = 'force-dynamic'

export default async function SignupPage() {
  const enabled = await signupEnabled()
  return (
    <main className="grid min-h-screen place-items-center px-4 py-10">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-3 h-10 w-10 rounded-full bg-brand" aria-hidden />
          <h1 className="text-2xl">Create your research workspace</h1>
          <p className="mt-2 text-sm text-ink-2">A private workspace for your organization. Your projects, formulas and reports are never visible to other customers.</p>
        </div>
        <div className="rounded-2xl border border-line bg-paper p-6">{enabled ? <SignupForm /> : <p className="text-sm text-ink-2">Accounts are currently created by invitation. Contact Supernatural for access.</p>}</div>
        <p className="mt-6 text-center text-sm">Already have an account? <Link href="/login">Sign in</Link></p>
      </div>
    </main>
  )
}
