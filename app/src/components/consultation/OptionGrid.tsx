interface OptionGridProps<T extends string> {
  options: { value: T; label: string; description: string }[]
  value: T
  onChange: (value: T) => void
}

export default function OptionGrid<T extends string>({ options, value, onChange }: OptionGridProps<T>) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {options.map((opt) => {
        const active = opt.value === value
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            className={`rounded-2xl border px-4 py-3 text-left transition-colors ${
              active
                ? 'border-fuchsia-300 bg-fuchsia-400/15 text-ink-900'
                : 'border-ink-900/15 bg-ink-900/5 text-ink-900/70 hover:border-ink-900/30'
            }`}
          >
            <p className="text-sm font-semibold">{opt.label}</p>
            {opt.description && <p className="mt-1 text-xs text-ink-900/50">{opt.description}</p>}
          </button>
        )
      })}
    </div>
  )
}
