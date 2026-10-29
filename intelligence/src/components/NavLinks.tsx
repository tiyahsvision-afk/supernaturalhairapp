'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState } from 'react'

export function NavLinks({ items }: { items: { href: string; label: string; group: string }[] }) {
  const path = usePathname()
  const [open, setOpen] = useState(false)
  const groups = [...new Set(items.map((i) => i.group))]
  return (
    <>
      <button className="mx-4 mb-3 rounded-full border border-line px-3 py-1 text-sm lg:hidden" aria-expanded={open} onClick={() => setOpen(!open)}>{open ? 'Close menu' : 'Menu'}</button>
      <nav aria-label="Main" className={`${open ? 'block' : 'hidden'} px-2 pb-4 lg:block`}>
        {groups.map((g) => (
          <div key={g} className="mb-3">
            <div className="px-3 pb-1 text-[11px] font-semibold uppercase tracking-widest text-ink-3">{g}</div>
            {items.filter((i) => i.group === g).map((i) => {
              const active = i.href === '/' ? path === '/' : path.startsWith(i.href)
              return (
                <Link key={i.href} href={i.href} onClick={() => setOpen(false)} aria-current={active ? 'page' : undefined}
                  className={`block rounded-lg px-3 py-1.5 text-sm no-underline hover:no-underline ${active ? 'bg-brand-100 font-semibold text-ink' : 'text-ink-2 hover:bg-paper hover:text-ink'}`}>{i.label}</Link>
              )
            })}
          </div>
        ))}
      </nav>
    </>
  )
}
