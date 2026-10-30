import type { ReactNode } from 'react'
import type { DerivedClass } from '@/lib/classify'
import { STATUS_META, type DataStatus, type Dimension } from '@/lib/dimensions'

const TONE: Record<string, string> = {
  good: 'bg-paper-2 text-good border-line',
  info: 'bg-brand-100 text-brand-700 border-brand-200',
  warn: 'bg-paper-2 text-warn border-line',
  bad: 'bg-paper-2 text-ink-3 border-line',
  neutral: 'bg-paper-2 text-ink-2 border-line',
}
const ICON: Record<DataStatus, string> = { VERIFIED: '✓', REPORTED: '◆', SUPPLIER: '▲', DERIVED: '≈', HYPOTHESIS: '?', MISSING: '–', NOT_APPLICABLE: '∅' }

/** Data-status pill: icon + label (never colour alone), with the status definition as a tooltip. */
export function StatusPill({ status }: { status: DataStatus }) {
  const m = STATUS_META[status]
  return (
    <span title={m.help} className={`inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full border px-2 py-0.5 text-[11px] font-medium ${TONE[m.tone]}`}>
      <span aria-hidden>{ICON[status]}</span>{m.label}
    </span>
  )
}

export function StatusLegend({ only }: { only?: DataStatus[] }) {
  const keys = (only ?? (Object.keys(STATUS_META) as DataStatus[]))
  return (
    <details className="text-xs text-ink-3">
      <summary className="cursor-pointer select-none">How to read data status</summary>
      <ul className="mt-2 grid gap-1.5 sm:grid-cols-2">
        {keys.map((k) => <li key={k} className="flex items-start gap-2"><StatusPill status={k} /><span>{STATUS_META[k].help}</span></li>)}
      </ul>
    </details>
  )
}

export function DimensionTable({ dims }: { dims: Dimension[] }) {
  const groups = [...new Set(dims.map((d) => d.group))]
  return (
    <div className="space-y-5">
      {groups.map((g) => (
        <div key={g}>
          <h3 className="mb-1.5 text-xs font-semibold uppercase tracking-widest text-ink-3">{g}</h3>
          <dl className="divide-y divide-line rounded-xl border border-line">
            {dims.filter((d) => d.group === g).map((d) => (
              <div key={d.key} className="grid gap-1 px-3 py-2.5 sm:grid-cols-[12rem_1fr_auto] sm:items-start sm:gap-3">
                <dt className="text-sm text-ink-2" title={d.help}>{d.label}</dt>
                <dd className="min-w-0 text-sm text-ink">
                  {d.value ?? <span className="text-ink-3">{d.status === 'NOT_APPLICABLE' ? 'Not applicable' : 'No sourced value'}</span>}
                  {(d.source || d.note) && <div className="mt-0.5 text-xs text-ink-3">{d.source && <>Source: {d.source}</>}{d.source && d.note && ' · '}{d.note}</div>}
                </dd>
                <dd><StatusPill status={d.status} /></dd>
              </div>
            ))}
          </dl>
        </div>
      ))}
    </div>
  )
}

const GROUP_LABEL: Record<DerivedClass['group'], string> = { surfactant: 'Surfactant', charge: 'Charge', composition: 'Composition', screening: 'Screening', 'regulatory-labelling': 'Labelling' }

export function DerivedChips({ classes, empty }: { classes: DerivedClass[]; empty?: ReactNode }) {
  if (!classes.length) return <>{empty ?? <span className="text-sm text-ink-3">No rule-based classes apply.</span>}</>
  return (
    <ul className="flex flex-wrap gap-1.5">
      {classes.map((c) => (
        <li key={c.code}>
          <span title={`${GROUP_LABEL[c.group]} · Rule: ${c.basis}`} className="inline-flex items-center gap-1 rounded-full border border-line bg-paper-2 px-2.5 py-1 text-xs text-ink-2">
            <span aria-hidden className="text-ink-3">≈</span>{c.label}
          </span>
        </li>
      ))}
    </ul>
  )
}
