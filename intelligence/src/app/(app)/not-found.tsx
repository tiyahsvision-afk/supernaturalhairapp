import Link from 'next/link'
export default function NotFound() {
  return (
    <div className="mx-auto max-w-xl py-16 text-center">
      <div className="font-serif text-2xl">Not found</div>
      <p className="mt-2 text-sm text-ink-2">This record does not exist, was merged into another record, or is not visible to your organization.</p>
      <Link href="/" className="mt-4 inline-block text-sm">Back to dashboard</Link>
    </div>
  )
}
