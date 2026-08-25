import type { ReactNode } from 'react'

interface PageShellProps {
  children: ReactNode
  className?: string
}

export default function PageShell({ children, className = '' }: PageShellProps) {
  return (
    <main className={`mx-auto w-full max-w-7xl px-4 py-10 sm:px-6 ${className}`}>{children}</main>
  )
}
