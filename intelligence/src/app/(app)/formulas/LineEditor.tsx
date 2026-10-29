'use client'
import { useMemo, useState } from 'react'

export interface Option { value: string; label: string }
interface Line { ref: string; pct: string; phase: string; role: string }

// Client-side preview of the 100% check. The server re-validates with integer arithmetic; this is a convenience only.
export function LineEditor({ options, initial = [] }: { options: Option[]; initial?: Line[] }) {
  const [lines, setLines] = useState<Line[]>(initial.length ? initial : [{ ref: '', pct: 'qs', phase: 'A', role: 'solvent' }, { ref: '', pct: '', phase: 'A', role: '' }])
  const total = useMemo(() => lines.filter((l) => l.pct && l.pct !== 'qs').reduce((a, l) => a + Math.round(Number(l.pct) * 1e5), 0) / 1e5, [lines])
  const qs = lines.filter((l) => l.pct === 'qs').length
  const set = (i: number, k: keyof Line, v: string) => setLines(lines.map((l, j) => (j === i ? { ...l, [k]: v } : l)))
  const byValue = new Map(options.map((o) => [o.value, o.label]))
  return (
    <div>
      <datalist id="formula-options">{options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</datalist>
      <div className="overflow-x-auto"><table><thead><tr><th>#</th><th>Ingredient or raw material</th><th>% w/w or “qs”</th><th>Phase</th><th>Functional role</th><th /></tr></thead><tbody>
        {lines.map((l, i) => (
          <tr key={i}>
            <td className="text-xs text-ink-3">{i + 1}</td>
            <td className="min-w-72"><input list="formula-options" name={`ref_${i}`} value={l.ref} onChange={(e) => set(i, 'ref', e.target.value)} placeholder="Type to search…" /><input type="hidden" name={`name_${i}`} value={byValue.get(l.ref) ?? ''} /><div className="text-xs text-ink-3">{byValue.get(l.ref) ?? (l.ref ? 'Not a recognized ingredient/raw material' : '')}</div></td>
            <td><input name={`pct_${i}`} value={l.pct} onChange={(e) => set(i, 'pct', e.target.value)} className="w-24" /></td>
            <td><input name={`phase_${i}`} value={l.phase} onChange={(e) => set(i, 'phase', e.target.value)} className="w-16" /></td>
            <td><input name={`role_${i}`} value={l.role} onChange={(e) => set(i, 'role', e.target.value)} /></td>
            <td><button type="button" className="text-xs text-bad" onClick={() => setLines(lines.filter((_, j) => j !== i))}>Remove</button></td>
          </tr>
        ))}
      </tbody></table></div>
      <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-sm">
        <button type="button" className="rounded-full border border-line px-3 py-1" onClick={() => setLines([...lines, { ref: '', pct: '', phase: 'A', role: '' }])}>Add line</button>
        <span aria-live="polite" className={qs > 1 || (qs === 0 && Math.abs(total - 100) > 0.001) || total > 100 ? 'text-bad' : 'text-good'}>
          Explicit total {total}%{qs === 1 ? ` · q.s. = ${(Math.round((100 - total) * 1e5) / 1e5)}%` : ''}{qs > 1 ? ' · only one q.s. line allowed' : ''}
        </span>
      </div>
    </div>
  )
}
