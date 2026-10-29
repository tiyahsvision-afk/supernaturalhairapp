import Link from 'next/link'
import type { GraphLink, GraphNode } from '@/lib/services/graph'

// Radial layout: focus node in the centre, neighbours grouped by node type around it.
// Identity is carried by text labels and a legend — never by color alone. Proposed (unreviewed) edges are dashed.
const TYPE_STYLE: Record<string, { fill: string; label: string }> = {
  Ingredient: { fill: '#9bc9ff', label: 'Ingredient' },
  Product: { fill: '#f2d0a4', label: 'Product' },
  Study: { fill: '#c7e8cf', label: 'Evidence' },
  Patent: { fill: '#e2d4f0', label: 'Patent' },
  Formula: { fill: '#f5c2c7', label: 'Formula (private)' },
  RawMaterial: { fill: '#ffe7a3', label: 'Raw material' },
  Function: { fill: '#d9dee7', label: 'Function' },
  IngredientFamily: { fill: '#e8e3d8', label: 'Family' },
  HairPhenotype: { fill: '#bfe3e0', label: 'Hair phenotype' },
  ScalpPhenotype: { fill: '#bfe3e0', label: 'Scalp phenotype' },
  Outcome: { fill: '#bfe3e0', label: 'Outcome' },
  Regulation: { fill: '#f7c6b5', label: 'Regulatory record' },
  Supplier: { fill: '#e8e3d8', label: 'Supplier' },
}

export function GraphSvg({ focusKey, nodes, links, width = 900, height = 620 }: { focusKey: string; nodes: GraphNode[]; links: GraphLink[]; width?: number; height?: number }) {
  const cx = width / 2, cy = height / 2
  const others = nodes.filter((n) => `${n.type}:${n.id}` !== focusKey)
  const groups = [...new Set(others.map((n) => n.type))]
  const pos = new Map<string, { x: number; y: number }>()
  pos.set(focusKey, { x: cx, y: cy })
  let idx = 0
  const total = others.length || 1
  for (const g of groups) {
    const members = others.filter((n) => n.type === g)
    members.forEach((n, i) => {
      const angle = ((idx + i) / total) * Math.PI * 2 - Math.PI / 2
      const ring = 0.36 + (i % 2) * 0.09
      pos.set(`${n.type}:${n.id}`, { x: cx + Math.cos(angle) * width * ring, y: cy + Math.sin(angle) * height * ring })
    })
    idx += members.length
  }
  const focus = nodes.find((n) => `${n.type}:${n.id}` === focusKey)
  return (
    <figure>
      <div className="overflow-x-auto rounded-2xl border border-line bg-paper">
        <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label={`Knowledge graph around ${focus?.label ?? 'node'}`} className="h-auto min-w-[640px] w-full">
          {links.map((l) => {
            const a = pos.get(l.from), b = pos.get(l.to)
            if (!a || !b) return null
            return (
              <g key={l.id}>
                <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="var(--color-ink-3)" strokeOpacity={0.25 + l.confidence * 0.5} strokeWidth={1.5} strokeDasharray={l.status === 'ACTIVE' ? undefined : '4 4'} />
                <title>{`${l.edgeType} · confidence ${l.confidence} · ${l.reviewStatus.toLowerCase()}${l.source ? ` · ${l.source}` : ''}`}</title>
              </g>
            )
          })}
          {nodes.map((n) => {
            const key = `${n.type}:${n.id}`
            const p = pos.get(key)
            if (!p) return null
            const isFocus = key === focusKey
            const style = TYPE_STYLE[n.type] ?? { fill: '#ddd', label: n.type }
            const label = n.label.length > 28 ? `${n.label.slice(0, 26)}…` : n.label
            const inner = (
              <g>
                <circle cx={p.x} cy={p.y} r={isFocus ? 16 : 9} fill={style.fill} stroke="var(--color-paper)" strokeWidth={2} />
                <text x={p.x} y={p.y + (isFocus ? 32 : 22)} textAnchor="middle" fontSize={isFocus ? 14 : 11} fill="var(--color-ink)" fontWeight={isFocus ? 600 : 400}>{label}</text>
                <title>{`${style.label}: ${n.label}`}</title>
              </g>
            )
            const href = n.type === 'Ingredient' || n.type === 'Product' || n.type === 'Patent' || n.type === 'Study' ? `/graph?type=${n.type}&id=${n.id}` : n.href
            return href && !isFocus ? <Link key={key} href={href}>{inner}</Link> : <g key={key}>{inner}</g>
          })}
        </svg>
      </div>
      <figcaption className="mt-2 flex flex-wrap gap-3 text-xs text-ink-2">
        {[...new Set(nodes.map((n) => n.type))].map((t) => (
          <span key={t} className="inline-flex items-center gap-1"><span className="inline-block h-3 w-3 rounded-full border border-line" style={{ background: TYPE_STYLE[t]?.fill ?? '#ddd' }} />{TYPE_STYLE[t]?.label ?? t}</span>
        ))}
        <span>— solid line: reviewed/active · dashed: proposed, not reviewed</span>
      </figcaption>
    </figure>
  )
}
