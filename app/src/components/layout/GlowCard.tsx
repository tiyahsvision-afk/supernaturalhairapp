import type { HTMLAttributes, ReactNode } from 'react'

interface GlowCardProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode
}

export default function GlowCard({ children, className = '', ...rest }: GlowCardProps) {
  return (
    <div
      className={`glass-panel glow-border rounded-3xl p-6 shadow-[0_0_1px_rgba(255,255,255,0.4)] ${className}`}
      {...rest}
    >
      {children}
    </div>
  )
}
