import QRCode from 'qrcode'
import { unseal } from '@/lib/crypto'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/db'
import { getSession } from '@/lib/auth/next'
import { otpauthUri } from '@/lib/auth/totp'
import { startEnrollmentAction } from './actions'
import { EnrollForm, VerifyForm } from './forms'

export default async function MfaPage({ searchParams }: { searchParams: Promise<{ enroll?: string }> }) {
  const s = await getSession()
  if (!s) redirect('/login')
  const { enroll } = await searchParams
  const u = await prisma.user.findUniqueOrThrow({ where: { id: s.user.id } })
  const enrolling = enroll === '1' && !u.mfaEnabled
  const secret = enrolling && u.mfaSecret ? unseal(u.mfaSecret) : null
  // QR code rendered on the server so the secret is never sent to a third-party service.
  const qrSvg = secret ? await QRCode.toString(otpauthUri(secret, u.email), { type: 'svg', margin: 1, errorCorrectionLevel: 'M' }) : null
  return (
    <main className="grid min-h-screen place-items-center px-4">
      <div className="w-full max-w-md rounded-2xl border border-line bg-paper p-6">
        <h1 className="mb-2 text-2xl">Two-factor authentication</h1>
        {!enrolling && u.mfaEnabled && (<><p className="mb-4 text-sm text-ink-2">Enter the code from your authenticator app.</p><VerifyForm /></>)}
        {enrolling && !u.mfaSecret && (
          <form action={startEnrollmentAction}>
            <p className="mb-4 text-sm text-ink-2">Your role has access to private formulas, participant data, potential IP or administrative controls, so two-factor authentication is required.</p>
            <button type="submit" className="w-full rounded-full border border-brand bg-brand px-4 py-2 text-sm font-semibold text-[#0d2440]">Set up authenticator</button>
          </form>
        )}
        {enrolling && u.mfaSecret && (
          <>
            <p className="mb-3 text-sm text-ink-2">Scan this code with an authenticator app (Google Authenticator, Microsoft Authenticator, 1Password, Authy), then enter the 6-digit code it shows.</p>
            {qrSvg && <div className="mx-auto mb-3 w-48 rounded-lg bg-white p-2" aria-label="QR code for your authenticator app" role="img" dangerouslySetInnerHTML={{ __html: qrSvg }} />}
            <div className="mb-1 text-xs text-ink-3">Can’t scan? Enter this setup key instead</div>
            <code className="mb-2 block break-all rounded-lg bg-paper-2 p-2">{secret?.match(/.{1,4}/g)?.join(' ')}</code>
            <details className="mb-4 text-xs text-ink-3"><summary>otpauth URI</summary><code className="break-all">{otpauthUri(secret ?? '', u.email)}</code></details>
            <EnrollForm />
          </>
        )}
        {!enrolling && !u.mfaEnabled && <p className="text-sm">Two-factor authentication is not enabled. <a href="/mfa?enroll=1">Set it up</a> or <a href="/">continue</a>.</p>}
      </div>
    </main>
  )
}
