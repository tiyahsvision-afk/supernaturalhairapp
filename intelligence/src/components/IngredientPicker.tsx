'use client'
import { useEffect, useRef, useState } from 'react'

interface Option { id: string; label: string; detail: string | null }

/**
 * Type-ahead ingredient picker over the search API (22k+ ingredients). Submits the chosen id(s) as hidden inputs named
 * `name`. With `multiple`, up to `max` ingredients can be chosen.
 */
export function IngredientPicker({ name, label, multiple = false, max = 6, initial = [], required = false, hint }: { name: string; label: string; multiple?: boolean; max?: number; initial?: Option[]; required?: boolean; hint?: string }) {
  const [q, setQ] = useState('')
  const [opts, setOpts] = useState<Option[]>([])
  const [chosen, setChosen] = useState<Option[]>(initial)
  const [open, setOpen] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => {
    if (timer.current) clearTimeout(timer.current)
    if (q.trim().length < 2) { setOpts([]); return }
    timer.current = setTimeout(async () => {
      const r = await fetch(`/api/v1/search?type=ingredient&limit=8&q=${encodeURIComponent(q.trim())}`)
      if (!r.ok) return
      const j = (await r.json()) as { data: { entityId: string; label: string; detail: string | null }[] }
      setOpts(j.data.map((h) => ({ id: h.entityId, label: h.label, detail: h.detail })))
      setOpen(true)
    }, 200)
  }, [q])
  const pick = (o: Option) => {
    setChosen((c) => (multiple ? (c.some((x) => x.id === o.id) || c.length >= max ? c : [...c, o]) : [o]))
    setQ(''); setOpts([]); setOpen(false)
  }
  const full = multiple && chosen.length >= max
  return (
    <div className="block text-sm">
      <span className="mb-1 block font-medium">{label}</span>
      {chosen.map((c) => <input key={c.id} type="hidden" name={name} value={c.id} />)}
      {chosen.length > 0 && (
        <ul className="mb-2 flex flex-wrap gap-1.5">
          {chosen.map((c) => (
            <li key={c.id} className="inline-flex items-center gap-1 rounded-full border border-brand-200 bg-brand-100 px-2.5 py-1 text-xs text-brand-700">
              {c.label}
              <button type="button" aria-label={`Remove ${c.label}`} onClick={() => setChosen((x) => x.filter((y) => y.id !== c.id))} className="ml-0.5 text-brand-700/70 hover:text-brand-700">×</button>
            </li>
          ))}
        </ul>
      )}
      {(!chosen.length || multiple) && !full && (
        <div className="relative">
          <input value={q} onChange={(e) => setQ(e.target.value)} onFocus={() => opts.length && setOpen(true)} onBlur={() => setTimeout(() => setOpen(false), 150)} placeholder="Type an INCI name, synonym or CAS…" aria-label={label} required={required && !chosen.length} autoComplete="off" />
          {open && opts.length > 0 && (
            <ul role="listbox" className="absolute z-20 mt-1 max-h-72 w-full overflow-auto rounded-xl border border-line bg-paper shadow-lg">
              {opts.map((o) => (
                <li key={o.id} role="option" aria-selected={false}>
                  <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => pick(o)} className="block w-full px-3 py-2 text-left hover:bg-paper-2">
                    <span className="text-ink">{o.label}</span>{o.detail && <span className="block text-xs text-ink-3">{o.detail}</span>}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
      {hint && <span className="mt-1 block text-xs text-ink-3">{hint}</span>}
    </div>
  )
}
