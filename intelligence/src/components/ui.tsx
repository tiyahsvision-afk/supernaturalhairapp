import Link from 'next/link'
import type { ReactNode } from 'react'

export function PageHeader({ title, subtitle, actions, eyebrow }: { title: string; subtitle?: ReactNode; actions?: ReactNode; eyebrow?: string }) {
  return (
    <div className="mb-6 flex flex-col gap-3 border-b border-line pb-5 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        {eyebrow && <div className="mb-1 text-xs font-semibold uppercase tracking-widest text-ink-3">{eyebrow}</div>}
        <h1 className="text-3xl leading-tight text-ink">{title}</h1>
        {subtitle && <div className="mt-1 max-w-3xl text-sm text-ink-2">{subtitle}</div>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  )
}

export function Card({ title, children, actions, className = '' }: { title?: ReactNode; children: ReactNode; actions?: ReactNode; className?: string }) {
  return (
    <section className={`rounded-2xl border border-line bg-paper p-5 shadow-[0_1px_0_rgba(0,0,0,0.02)] ${className}`}>
      {(title || actions) && (
        <div className="mb-3 flex items-center justify-between gap-2">
          {title && <h2 className="text-lg text-ink">{title}</h2>}
          {actions}
        </div>
      )}
      {children}
    </section>
  )
}

type Tone = 'neutral' | 'brand' | 'good' | 'warn' | 'bad'
const TONES: Record<Tone, string> = {
  neutral: 'bg-paper-2 text-ink-2 border-line',
  brand: 'bg-brand-100 text-brand-700 border-brand-200',
  good: 'bg-paper-2 text-good border-line',
  warn: 'bg-paper-2 text-warn border-line',
  bad: 'bg-paper-2 text-bad border-line',
}
const ICON: Record<Tone, string> = { neutral: '', brand: '', good: '✓ ', warn: '! ', bad: '✕ ' }

export function Badge({ children, tone = 'neutral', title }: { children: ReactNode; tone?: Tone; title?: string }) {
  return <span title={title} className={`inline-flex items-center whitespace-nowrap rounded-full border px-2 py-0.5 text-xs font-medium ${TONES[tone]}`}>{ICON[tone]}{children}</span>
}

const REVIEW_TONE: Record<string, Tone> = { APPROVED: 'good', REJECTED: 'bad', SUPERSEDED: 'neutral', EXPIRED: 'warn', RE_REVIEW_REQUIRED: 'warn', CHANGES_REQUESTED: 'warn', SECOND_REVIEW_REQUIRED: 'warn' }
export function ReviewBadge({ status }: { status: string }) {
  const label = status === 'APPROVED' ? 'Reviewed & approved' : status === 'SUBMITTED' ? 'Not yet reviewed' : status.replace(/_/g, ' ').toLowerCase()
  return <Badge tone={REVIEW_TONE[status] ?? 'neutral'}>{label}</Badge>
}

export function EntryModeBadge({ mode }: { mode: string }) {
  if (mode === 'AI_EXTRACTED') return <Badge tone="warn" title="Proposed with AI assistance; requires human review">AI draft</Badge>
  if (mode === 'MANUAL') return <Badge>Manual entry</Badge>
  return <Badge>Imported</Badge>
}

export function Provenance({ source, entryMode, reviewStatus, location }: { source?: { name: string; id: string; rightsStatus?: string } | null; entryMode?: string; reviewStatus?: string; location?: string | null }) {
  return (
    <div className="flex flex-wrap items-center gap-1.5 text-xs text-ink-3">
      {source ? <Link href={`/sources/${source.id}`} className="underline decoration-dotted">Source: {source.name}</Link> : <Badge tone="bad">No source</Badge>}
      {location && <span className="mono">· {location}</span>}
      {entryMode && <EntryModeBadge mode={entryMode} />}
      {reviewStatus && <ReviewBadge status={reviewStatus} />}
    </div>
  )
}

export function Notice({ kind = 'info', title, children }: { kind?: 'info' | 'warn' | 'danger'; title?: string; children: ReactNode }) {
  const style = kind === 'danger' ? 'border-l-bad' : kind === 'warn' ? 'border-l-warn' : 'border-l-brand'
  return (
    <div role={kind === 'info' ? 'note' : 'alert'} className={`my-3 rounded-r-xl border border-l-4 border-line bg-paper-2 px-4 py-3 text-sm text-ink-2 ${style}`}>
      {title && <div className="mb-0.5 font-semibold text-ink">{kind === 'danger' ? '✕ ' : kind === 'warn' ? '! ' : 'ⓘ '}{title}</div>}
      {children}
    </div>
  )
}

export function EmptyState({ title, children, action }: { title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="rounded-2xl border border-dashed border-line px-6 py-10 text-center">
      <div className="font-serif text-lg text-ink">{title}</div>
      {children && <div className="mx-auto mt-1 max-w-xl text-sm text-ink-2">{children}</div>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}

export function PermissionDenied({ permission, note }: { permission: string; note?: string }) {
  return (
    <div className="mx-auto max-w-xl py-16 text-center">
      <div className="font-serif text-2xl text-ink">You don’t have access to this</div>
      <p className="mt-2 text-sm text-ink-2">This page requires the <code>{permission}</code> permission{note ? ` — ${note}` : ''}. Ask a platform administrator if you need access. The attempt has been logged.</p>
      <Link href="/" className="mt-4 inline-block text-sm">Back to dashboard</Link>
    </div>
  )
}

export function Stat({ label, value, hint, href, status }: { label: string; value: number | string; hint?: string; href?: string; status?: 'good' | 'warn' | 'bad' }) {
  const body = (
    <div className="h-full rounded-2xl border border-line bg-paper p-4 transition hover:border-brand">
      <div className="text-xs font-medium uppercase tracking-wide text-ink-3">{label}</div>
      <div className="mt-1 font-serif text-3xl tabular-nums text-ink">{typeof value === 'number' ? value.toLocaleString() : value}</div>
      {(hint || status) && <div className="mt-1 flex items-center gap-1.5 text-xs text-ink-2">{status && <Badge tone={status}>{status === 'good' ? 'OK' : status === 'warn' ? 'Attention' : 'Action needed'}</Badge>}{hint}</div>}
    </div>
  )
  return href ? <Link href={href} className="block no-underline hover:no-underline">{body}</Link> : body
}

export function Tabs({ tabs, active, base }: { tabs: { key: string; label: string; count?: number }[]; active: string; base: string }) {
  return (
    <nav aria-label="Sections" className="-mx-1 mb-5 flex gap-1 overflow-x-auto border-b border-line pb-px">
      {tabs.map((t) => (
        <Link key={t.key} href={`${base}${base.includes('?') ? '&' : '?'}tab=${t.key}`} aria-current={t.key === active ? 'page' : undefined}
          className={`whitespace-nowrap rounded-t-lg px-3 py-2 text-sm no-underline hover:no-underline ${t.key === active ? 'border-b-2 border-brand-600 font-semibold text-ink' : 'text-ink-2 hover:text-ink'}`}>
          {t.label}{t.count !== undefined && <span className="ml-1 text-xs text-ink-3">{t.count}</span>}
        </Link>
      ))}
    </nav>
  )
}

export function Button({ children, variant = 'primary', type = 'submit', name, value, disabled }: { children: ReactNode; variant?: 'primary' | 'secondary' | 'danger'; type?: 'submit' | 'button'; name?: string; value?: string; disabled?: boolean }) {
  const v = variant === 'primary' ? 'bg-brand text-[#0d2440] hover:bg-brand-200 border-brand' : variant === 'danger' ? 'bg-paper text-bad border-line hover:bg-paper-2' : 'bg-paper text-ink border-line hover:bg-paper-2'
  return <button type={type} name={name} value={value} disabled={disabled} className={`inline-flex items-center justify-center rounded-full border px-4 py-1.5 text-sm font-medium disabled:opacity-50 ${v}`}>{children}</button>
}

export function LinkButton({ href, children, variant = 'secondary' }: { href: string; children: ReactNode; variant?: 'primary' | 'secondary' }) {
  const v = variant === 'primary' ? 'bg-brand text-[#0d2440] border-brand hover:bg-brand-200' : 'bg-paper text-ink border-line hover:bg-paper-2'
  return <Link href={href} className={`inline-flex items-center rounded-full border px-4 py-1.5 text-sm font-medium no-underline hover:no-underline ${v}`}>{children}</Link>
}

export function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return (
    <label className="block text-sm">
      <span className="mb-1 block font-medium text-ink">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-ink-3">{hint}</span>}
    </label>
  )
}

export function KeyValue({ items }: { items: [string, ReactNode][] }) {
  return (
    <dl className="grid grid-cols-1 gap-x-6 gap-y-2 text-sm sm:grid-cols-[minmax(140px,max-content)_1fr]">
      {items.map(([k, v]) => (
        <div key={k} className="contents">
          <dt className="text-ink-3">{k}</dt>
          <dd className="min-w-0 break-words text-ink">{v ?? <span className="text-ink-3">—</span>}</dd>
        </div>
      ))}
    </dl>
  )
}

export function TableWrap({ children }: { children: ReactNode }) {
  return <div className="-mx-2 overflow-x-auto px-2">{children}</div>
}

export function Pagination({ page, pageSize, total, base }: { page: number; pageSize: number; total: number; base: string }) {
  const pages = Math.max(1, Math.ceil(total / pageSize))
  if (pages <= 1) return <div className="mt-3 text-xs text-ink-3">{total.toLocaleString()} record(s)</div>
  const sep = base.includes('?') ? '&' : '?'
  return (
    <div className="mt-4 flex items-center justify-between text-sm">
      <span className="text-ink-3">{total.toLocaleString()} records · page {page} of {pages}</span>
      <span className="flex gap-2">
        {page > 1 && <Link href={`${base}${sep}page=${page - 1}`}>← Previous</Link>}
        {page < pages && <Link href={`${base}${sep}page=${page + 1}`}>Next →</Link>}
      </span>
    </div>
  )
}

export const DISCLAIMERS = {
  observational: 'Observational signal — does not establish causation.',
  patent: 'Research aid — not a legal opinion. A patent’s existence does not establish efficacy, validity, freedom to operate or commercial permission.',
  supplier: 'Supplier-provided information — not independent scientific evidence.',
  sample: 'SAMPLE record — illustrative only. Not a Supernatural formula. Not for manufacture. Candidate for cosmetic-chemist review.',
  aiDraft: 'AI draft — not reviewed by a qualified reviewer.',
  completeness: 'Completeness counts source-backed fields. It is not a measure of scientific quality or safety.',
  limits: 'This platform organizes evidence, observations, relationships and research workflows. It cannot by itself establish ingredient or formula safety, efficacy, regulatory compliance, freedom to operate, causation or final claims. Qualified professionals make those decisions.',
}
