'use client'
export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const denied = error.message?.startsWith('Permission denied')
  return (
    <div className="mx-auto max-w-xl py-16 text-center">
      <div className="font-serif text-2xl">{denied ? 'You don’t have access to this action' : 'Something went wrong'}</div>
      <p className="mt-2 text-sm text-ink-2">{denied ? error.message : 'The error has been recorded. No data was changed by the failed request unless a confirmation was shown.'}</p>
      {error.digest && <p className="mt-1 text-xs text-ink-3">Reference: {error.digest}</p>}
      <button type="button" onClick={reset} className="mt-4 rounded-full border border-line px-4 py-1.5 text-sm">Try again</button>
    </div>
  )
}
