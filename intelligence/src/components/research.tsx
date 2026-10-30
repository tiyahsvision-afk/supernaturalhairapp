import Link from 'next/link'
import { CERTAINTY_META, type Certainty, type Citation, type ResultTable, type WorkflowResult } from '@/lib/research/types'
import type { DataStatus } from '@/lib/dimensions'
import { StatusPill } from './intel'

const TONE: Record<string, string> = {
  good: 'border-good/40 text-good', info: 'border-brand-200 bg-brand-100 text-brand-700', warn: 'border-warn/40 text-warn', bad: 'border-bad/40 text-bad', neutral: 'border-line text-ink-2',
}
const ICON: Record<Certainty, string> = { ESTABLISHED: '✓', SUPPORTED: '◆', UNCERTAIN: '?', UNSUPPORTED: '✕', NEEDS_TESTING: '⚗', REVIEW_REQUIRED: '!', INFO: 'i' }

export function CertaintyPill({ c }: { c: Certainty }) {
  const m = CERTAINTY_META[c]
  return <span title={m.help} className={`inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full border bg-paper px-2 py-0.5 text-[11px] font-semibold ${TONE[m.tone]}`}><span aria-hidden>{ICON[c]}</span>{m.label}</span>
}

const ORDER: Certainty[] = ['REVIEW_REQUIRED', 'NEEDS_TESTING', 'UNSUPPORTED', 'UNCERTAIN', 'SUPPORTED', 'ESTABLISHED', 'INFO']

function TableView({ t }: { t: ResultTable }) {
  return (
    <div className="mb-6">
      <h3 className="mb-1 text-base text-ink">{t.title}</h3>
      {t.caption && <p className="mb-2 text-xs text-ink-3">{t.caption}</p>}
      <div className="overflow-x-auto rounded-xl border border-line">
        <table className="min-w-full text-sm">
          <thead><tr>{t.columns.map((c) => <th key={c} className="whitespace-nowrap bg-paper-2 px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-ink-3">{c}</th>)}</tr></thead>
          <tbody>
            {t.rows.map((r, i) => (
              <tr key={i} className="border-t border-line align-top">
                {r.map((cell, j) => {
                  const c = typeof cell === 'string' ? { text: cell } : cell
                  return (
                    <td key={j} className={`px-3 py-2 ${j === 0 ? 'font-medium text-ink' : 'text-ink-2'}`}>
                      <div className="flex flex-col gap-1">
                        {c.href ? <Link href={c.href}>{c.text}</Link> : <span className="whitespace-pre-line">{c.text}</span>}
                        {c.status && <StatusPill status={c.status as DataStatus} />}
                      </div>
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export function CitationList({ citations }: { citations: Citation[] }) {
  if (!citations.length) return <p className="text-sm text-ink-3">No sources were used.</p>
  return (
    <ol className="space-y-1 text-sm">
      {citations.map((c, i) => (
        <li key={c.id} id={`cite-${c.id}`} className="flex gap-2">
          <span className="w-7 shrink-0 text-right tabular-nums text-ink-3">{i + 1}.</span>
          <span><span className="mr-1 rounded bg-paper-2 px-1.5 py-0.5 text-[11px] uppercase tracking-wide text-ink-3">{c.kind.replace('_', ' ')}</span>{c.href ? (c.href.startsWith('http') ? <a href={c.href} target="_blank" rel="noreferrer">{c.label}</a> : <Link href={c.href}>{c.label}</Link>) : c.label}</span>
        </li>
      ))}
    </ol>
  )
}

/** Renders any workflow result: summary, findings by certainty, tables, questions, steps, limitations, sources. */
export function ResultView({ result, compact = false }: { result: WorkflowResult; compact?: boolean }) {
  const idx = new Map(result.citations.map((c, i) => [c.id, i + 1]))
  const findings = [...result.findings].sort((a, b) => ORDER.indexOf(a.certainty) - ORDER.indexOf(b.certainty))
  const counts = ORDER.map((c) => [c, result.findings.filter((f) => f.certainty === c).length] as const).filter(([, n]) => n > 0)
  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-line bg-paper p-5">
        <div className="mb-2 text-xs font-semibold uppercase tracking-widest text-ink-3">Summary</div>
        <p className="text-[15px] leading-relaxed text-ink">{result.summary}</p>
        {counts.length > 0 && <div className="mt-3 flex flex-wrap gap-1.5">{counts.map(([c, n]) => <span key={c} className="inline-flex items-center gap-1"><CertaintyPill c={c} /><span className="text-xs text-ink-3">×{n}</span></span>)}</div>}
      </section>
      {findings.length > 0 && (
        <section>
          <h2 className="mb-2 text-lg text-ink">Findings</h2>
          <ul className="divide-y divide-line rounded-2xl border border-line bg-paper">
            {findings.map((f, i) => (
              <li key={i} className="p-4">
                <div className="flex flex-wrap items-start justify-between gap-2"><div className="font-medium text-ink">{f.title}</div><CertaintyPill c={f.certainty} /></div>
                <p className="mt-1 text-sm text-ink-2">{f.detail}</p>
                {f.citations.length > 0 && <div className="mt-1.5 text-xs text-ink-3">Sources: {f.citations.map((c) => idx.get(c)).filter(Boolean).map((n) => <a key={n} href={`#cite-${result.citations[n! - 1].id}`} className="mr-1">[{n}]</a>)}</div>}
              </li>
            ))}
          </ul>
        </section>
      )}
      {result.tables.length > 0 && <section><h2 className="mb-2 text-lg text-ink">Comparisons &amp; data</h2>{result.tables.map((t) => <TableView key={t.title} t={t} />)}</section>}
      <div className="grid gap-4 lg:grid-cols-2">
        {result.openQuestions.length > 0 && <section className="rounded-2xl border border-line bg-paper p-5"><h2 className="mb-2 text-lg text-ink">Outstanding questions</h2><ul className="list-disc space-y-1 pl-5 text-sm text-ink-2">{result.openQuestions.map((q) => <li key={q}>{q}</li>)}</ul></section>}
        {result.nextSteps.length > 0 && <section className="rounded-2xl border border-line bg-paper p-5"><h2 className="mb-2 text-lg text-ink">Recommended next research steps</h2><ol className="list-decimal space-y-1 pl-5 text-sm text-ink-2">{result.nextSteps.map((q) => <li key={q}>{q}</li>)}</ol></section>}
      </div>
      {!compact && (
        <>
          <section className="rounded-2xl border border-line bg-paper-2 p-5">
            <h2 className="mb-2 text-lg text-ink">Limitations</h2>
            <ul className="list-disc space-y-1 pl-5 text-sm text-ink-2">{result.limitations.map((l) => <li key={l}>{l}</li>)}</ul>
            <h3 className="mb-1 mt-4 text-sm font-semibold text-ink">Methodology</h3>
            <p className="text-sm text-ink-2">{result.methodology}</p>
          </section>
          <section><h2 className="mb-2 text-lg text-ink">Sources</h2><CitationList citations={result.citations} /></section>
        </>
      )}
    </div>
  )
}
