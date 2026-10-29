/**
 * Search-quality evaluation. Runs a labelled query set against the current database and reports top-1 accuracy,
 * recall@5 and mean reciprocal rank (MRR@5), overall and per query kind. Exits non-zero below the thresholds.
 *   npm run eval:search            (uses DATABASE_URL)
 */
try { process.loadEnvFile() } catch { /* optional */ }
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { prisma } from '../src/lib/db'
import { search } from '../src/lib/search'
import type { Principal } from '../src/lib/permissions'

const MIN_TOP1 = Number(process.env.EVAL_MIN_TOP1 ?? 0.85)
const MIN_RECALL5 = Number(process.env.EVAL_MIN_RECALL5 ?? 0.95)

interface Case { q: string; expect: string; kind: string }

async function main() {
  const { cases, _meta } = JSON.parse(readFileSync(path.join(__dirname, 'data', 'search-eval.json'), 'utf8')) as { cases: Case[]; _meta: { version: string } }
  const org = await prisma.organization.findFirstOrThrow({ where: { type: 'INTERNAL' } })
  const principal: Principal = { id: '00000000-0000-0000-0000-000000000000', organizationId: org.id, roles: ['READ_ONLY_RESEARCHER'], kind: 'USER', label: 'search-eval' }
  const slugs = new Map((await prisma.ingredient.findMany({ select: { id: true, slug: true } })).map((i) => [i.id, i.slug]))
  const rows: { c: Case; rank: number | null; got: string | null; ms: number }[] = []
  for (const c of cases) {
    const res = await search(principal, c.q, { types: ['ingredient'], limit: 5 })
    const ranked = res.hits.map((h) => slugs.get(h.entityId))
    const idx = ranked.indexOf(c.expect)
    rows.push({ c, rank: idx >= 0 ? idx + 1 : null, got: ranked[0] ?? null, ms: res.durationMs })
  }
  const summarize = (rs: typeof rows) => ({
    n: rs.length,
    top1: rs.filter((r) => r.rank === 1).length / rs.length,
    recall5: rs.filter((r) => r.rank !== null).length / rs.length,
    mrr5: rs.reduce((a, r) => a + (r.rank ? 1 / r.rank : 0), 0) / rs.length,
  })
  const pct = (x: number) => `${(x * 100).toFixed(1)}%`
  const all = summarize(rows)
  console.log(`Search evaluation (${_meta.version}, ${all.n} queries)`)
  console.log(`  top-1 ${pct(all.top1)} · recall@5 ${pct(all.recall5)} · MRR@5 ${all.mrr5.toFixed(3)} · p95 latency ${[...rows].map((r) => r.ms).sort((a, b) => a - b)[Math.floor(rows.length * 0.95)]} ms`)
  for (const kind of [...new Set(rows.map((r) => r.c.kind))]) {
    const s = summarize(rows.filter((r) => r.c.kind === kind))
    console.log(`  ${kind.padEnd(12)} n=${String(s.n).padStart(2)} top-1 ${pct(s.top1).padStart(6)} recall@5 ${pct(s.recall5).padStart(6)}`)
  }
  const misses = rows.filter((r) => r.rank !== 1)
  if (misses.length) {
    console.log('\nNot ranked first:')
    for (const m of misses) console.log(`  "${m.c.q}" → expected ${m.c.expect}, rank ${m.rank ?? '—'} (top: ${m.got ?? 'no results'})`)
  }
  const ok = all.top1 >= MIN_TOP1 && all.recall5 >= MIN_RECALL5
  console.log(`\n${ok ? 'PASS' : 'FAIL'} (thresholds: top-1 ≥ ${pct(MIN_TOP1)}, recall@5 ≥ ${pct(MIN_RECALL5)})`)
  process.exit(ok ? 0 : 1)
}

main().catch((e) => { console.error(e); process.exit(1) }).finally(() => prisma.$disconnect())
