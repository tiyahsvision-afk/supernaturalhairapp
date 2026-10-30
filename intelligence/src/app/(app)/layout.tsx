import Link from 'next/link'
import { requireUser } from '@/lib/auth/next'
import { can, ROLE_LABELS, type Permission } from '@/lib/permissions'
import { NavLinks } from '@/components/NavLinks'

const NAV: { href: string; label: string; perm?: Permission; group: string }[] = [
  { href: '/', label: 'Home', group: 'Research' },
  { href: '/workbench', label: 'Research Workbench', perm: 'research:read', group: 'Research' },
  { href: '/founder', label: 'Product Brief Wizard', perm: 'research:write', group: 'Research' },
  { href: '/ingredients', label: 'Ingredients', perm: 'ingredient:read', group: 'Research' },
  { href: '/compare', label: 'Compare Ingredients', perm: 'research:write', group: 'Research' },
  { href: '/evidence', label: 'Scientific Evidence', perm: 'evidence:read', group: 'Research' },
  { href: '/products', label: 'Products', perm: 'product:read', group: 'Research' },
  { href: '/formulas', label: 'Formulas', perm: 'formula:read', group: 'Research' },
  { href: '/raw-materials', label: 'Raw Materials', perm: 'rawmaterial:read', group: 'Research' },
  { href: '/suppliers', label: 'Suppliers', perm: 'supplier:read', group: 'Research' },
  { href: '/patents', label: 'Patents', perm: 'patent:read', group: 'Research' },
  { href: '/graph', label: 'Knowledge Graph', perm: 'graph:read', group: 'Research' },
  { href: '/research-candidates', label: 'Research Candidates', perm: 'ip:read', group: 'Research' },
  { href: '/reports', label: 'Reports', perm: 'research:read', group: 'Research' },
  { href: '/admin', label: 'Data Operations', perm: 'review:read', group: 'Administration' },
  { href: '/review', label: 'Review Queue', perm: 'review:read', group: 'Administration' },
  { href: '/imports', label: 'Imports', perm: 'import:run', group: 'Administration' },
  { href: '/sources', label: 'Sources & Rights', perm: 'source:manage', group: 'Administration' },
  { href: '/integrations', label: 'Hair Passport (mock)', perm: 'integration:manage', group: 'Administration' },
  { href: '/completion', label: 'Phase 1 Completion', perm: 'review:read', group: 'Administration' },
  { href: '/audit', label: 'Audit History', perm: 'audit:read', group: 'Administration' },
  { href: '/organizations', label: 'Organizations', perm: 'org:manage', group: 'Administration' },
  { href: '/settings', label: 'Settings', group: 'Administration' },
  { href: '/api-docs', label: 'API', group: 'Administration' },
]

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const s = await requireUser()
  const items = NAV.filter((n) => !n.perm || can(s.principal, n.perm))
  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[240px_1fr] print:block">
      <aside className="print:hidden border-b border-line bg-paper-2 lg:sticky lg:top-0 lg:h-screen lg:overflow-y-auto lg:border-b-0 lg:border-r">
        <div className="flex items-center justify-between px-4 py-4 lg:block">
          <Link href="/" className="flex items-center gap-2 text-ink no-underline hover:no-underline">
            <span className="h-6 w-6 rounded-full bg-brand" aria-hidden />
            <span className="font-serif text-base leading-tight">Supernatural<br /><span className="text-ink-2">Ingredient Intelligence</span></span>
          </Link>
        </div>
        <NavLinks items={items.map(({ href, label, group }) => ({ href, label, group }))} />
        <div className="hidden border-t border-line px-4 py-4 text-xs text-ink-3 lg:block">
          <div className="font-medium text-ink-2">{s.user.name}</div>
          <div className="truncate">{s.user.email}</div>
          <div className="mt-1">{s.principal.roles.map((r) => ROLE_LABELS[r]).join(', ')}</div>
          <div className="truncate">{s.user.organizationName}</div>
        </div>
      </aside>
      <div className="min-w-0">
        <header className="print:hidden sticky top-0 z-10 flex items-center gap-3 border-b border-line bg-paper/95 px-4 py-3 backdrop-blur sm:px-6">
          <form action="/search" className="flex-1">
            <label className="sr-only" htmlFor="q">Search</label>
            <input id="q" name="q" placeholder="Search ingredients, INCI, CAS, CID, synonyms, products, patents, evidence…" className="max-w-2xl" />
          </form>
          <form action="/logout" method="post"><button className="whitespace-nowrap text-sm text-ink-2 hover:text-ink">Sign out</button></form>
        </header>
        <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:py-8">{children}</main>
        <footer className="print:hidden mx-auto max-w-7xl px-4 pb-8 text-xs text-ink-3 sm:px-6">Research and decision-support system. It does not diagnose, establish causation, determine legal compliance or authorize formulas for human use.</footer>
      </div>
    </div>
  )
}
