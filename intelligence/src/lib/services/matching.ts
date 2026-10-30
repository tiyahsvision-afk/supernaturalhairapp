import { prisma } from '../db'
import { normalizeName, stripParentheticals } from '../normalize'
import type { ParsedIngredientItem } from '../inci-parser'

export interface MatchResult {
  ingredientId: string | null
  confidence: number
  method: string | null
  status: 'MATCHED' | 'AMBIGUOUS' | 'UNMATCHED'
  candidates: string[]
}

export interface NameIndex {
  exact: Map<string, { ids: Set<string>; method: string; confidence: number }>
  /** Name with parentheticals removed → candidate ingredients, each with the confidence of the name it came from. */
  stripped: Map<string, Map<string, number>>
  /** Name with spaces and hyphens removed ("hydroxyethyl cellulose" → "hydroxyethylcellulose") → candidates. */
  compact: Map<string, Map<string, number>>
}

const compactKey = (s: string) => s.replace(/[\s-]+/g, '')

const ALIAS_CONFIDENCE: Record<string, number> = { SYNONYM: 0.95, ABBREVIATION: 0.9, TRADE_NAME: 0.85, LEGACY_NAME: 0.9, MISSPELLING: 0.85, LABEL_DISPLAY_NAME: 0.7 }

/** Builds an in-memory index of every active ingredient name, alias and canonical name. */
let cached: { at: number; index: Promise<NameIndex> } | null = null
/** Name index shared across requests for a few minutes (it covers ~22k ingredients and their aliases). */
export function cachedNameIndex(ttlMs = 5 * 60_000): Promise<NameIndex> {
  if (!cached || Date.now() - cached.at > ttlMs) cached = { at: Date.now(), index: buildNameIndex() }
  return cached.index
}

export async function buildNameIndex(): Promise<NameIndex> {
  const ings = await prisma.ingredient.findMany({ where: { status: 'ACTIVE' }, select: { id: true, canonicalName: true, inciName: true, displayName: true, names: { select: { normalized: true, nameType: true } }, aliases: { select: { normalized: true, aliasType: true } } } })
  const exact: NameIndex['exact'] = new Map()
  const stripped: NameIndex['stripped'] = new Map()
  const compact: NameIndex['compact'] = new Map()
  const add = (key: string, id: string, method: string, confidence: number) => {
    if (!key) return
    const cur = exact.get(key)
    if (!cur || confidence > cur.confidence) exact.set(key, { ids: new Set([id]), method, confidence })
    else if (confidence === cur.confidence) cur.ids.add(id)
    const s = stripParentheticals(key)
    const m = stripped.get(s) ?? new Map<string, number>()
    m.set(id, Math.max(m.get(id) ?? 0, confidence))
    stripped.set(s, m)
    const c = compact.get(compactKey(key)) ?? new Map<string, number>()
    c.set(id, Math.max(c.get(id) ?? 0, confidence))
    compact.set(compactKey(key), c)
  }
  for (const i of ings) {
    add(normalizeName(i.canonicalName), i.id, 'EXACT_CANONICAL', 1)
    if (i.inciName) add(normalizeName(i.inciName), i.id, 'EXACT_INCI', 1)
    add(normalizeName(i.displayName), i.id, 'EXACT_CANONICAL', 1)
    for (const n of i.names) add(n.normalized, i.id, n.nameType === 'INCI' ? 'EXACT_INCI' : 'EXACT_NAME', n.nameType === 'INCI' ? 1 : 0.95)
    for (const a of i.aliases) add(a.normalized, i.id, a.aliasType === 'LABEL_DISPLAY_NAME' ? 'LABEL_DISPLAY_ALIAS' : 'EXACT_ALIAS', ALIAS_CONFIDENCE[a.aliasType] ?? 0.9)
  }
  return { exact, stripped, compact }
}

/**
 * Matches a displayed label name to a canonical ingredient. Ambiguity is surfaced, never resolved by guessing:
 * multiple candidates or confidence < 0.9 ⇒ AMBIGUOUS and the line goes to identity review.
 * Label convention: US labels add common names in parentheses ("Rosmarinus Officinalis (Rosemary) Leaf Extract").
 * When removing them leaves exactly one ingredient whose INCI or established name matches exactly, that is a match
 * (method INCI_LABEL_FORM, confidence 0.9); otherwise the line stays AMBIGUOUS.
 * Other deterministic label variants, each accepted only when exactly one ingredient fits:
 * - multilingual names joined by "/" ("Water/Aqua/Eau") whose parts all resolve to the same ingredient;
 * - spacing/hyphen variants ("Hydroxyethyl Cellulose", "Polysorbate-20");
 * - colorants declared with their Colour Index number ("Blue 1 (CI 42090)").
 */
export function matchName(index: NameIndex, displayed: string): MatchResult {
  const key = normalizeName(displayed)
  const hit = index.exact.get(key)
  if (hit) {
    const ids = [...hit.ids]
    if (ids.length > 1) return { ingredientId: null, confidence: 0.5, method: hit.method, status: 'AMBIGUOUS', candidates: ids }
    return { ingredientId: ids[0], confidence: hit.confidence, method: hit.method, status: hit.confidence >= 0.9 ? 'MATCHED' : 'AMBIGUOUS', candidates: ids }
  }
  const single = (m?: Map<string, number>) => (m && m.size === 1 && [...m.values()][0] >= 0.95 ? [...m.keys()][0] : null)
  const variant = (id: string, method: string): MatchResult => ({ ingredientId: id, confidence: 0.9, method, status: 'MATCHED', candidates: [id] })
  if (key.includes('/') && !key.includes('(')) {
    const ids = new Set(key.split('/').map((p) => p.trim()).filter(Boolean).map((p) => { const h = index.exact.get(p); return h && h.ids.size === 1 && h.confidence >= 0.95 ? [...h.ids][0] : null }))
    if (ids.size === 1 && !ids.has(null)) return variant([...ids][0]!, 'MULTILINGUAL_NAME')
  }
  const ci = /\((ci \d{5})\)/.exec(key)
  if (ci) {
    const h = index.exact.get(ci[1])
    if (h && h.ids.size === 1) return variant([...h.ids][0], 'COLOUR_INDEX')
  }
  const s = index.stripped.get(stripParentheticals(displayed))
  if (s && s.size === 1) {
    const [[id, conf]] = [...s]
    if (conf >= 0.95) return { ingredientId: id, confidence: 0.9, method: 'INCI_LABEL_FORM', status: 'MATCHED', candidates: [id] }
    return { ingredientId: id, confidence: 0.85, method: 'PARENTHETICAL_STRIPPED', status: 'AMBIGUOUS', candidates: [id] }
  }
  if (s && s.size > 1) return { ingredientId: null, confidence: 0.4, method: 'PARENTHETICAL_STRIPPED', status: 'AMBIGUOUS', candidates: [...s.keys()] }
  const c = single(index.compact.get(compactKey(key)))
  if (c) return variant(c, 'SPACING_VARIANT')
  return { ingredientId: null, confidence: 0, method: null, status: 'UNMATCHED', candidates: [] }
}

/** Fuzzy fallback via trigram similarity against the search index (ingredients only). */
export async function fuzzyCandidates(displayed: string, limit = 3) {
  const q = normalizeName(displayed)
  return prisma.$queryRaw<{ entityId: string; label: string; sim: number }[]>`
    SELECT DISTINCT ON ("entityId") "entityId", label, similarity(normalized, ${q}) AS sim FROM "SearchEntry"
    WHERE "entityType" = 'ingredient' AND normalized % ${q}
    ORDER BY "entityId", sim DESC LIMIT ${limit * 4}`.then((r) => r.sort((a, b) => b.sim - a.sim).slice(0, limit))
}

export async function matchItems(items: ParsedIngredientItem[], index?: NameIndex) {
  const idx = index ?? (await buildNameIndex())
  const out: (ParsedIngredientItem & MatchResult)[] = []
  for (const it of items) {
    let m = matchName(idx, it.displayedName)
    if (m.status === 'UNMATCHED') {
      const fuzzy = await fuzzyCandidates(it.displayedName)
      if (fuzzy.length && fuzzy[0].sim >= 0.45) m = { ingredientId: fuzzy[0].entityId, confidence: Number((fuzzy[0].sim * 0.7).toFixed(3)), method: 'FUZZY', status: 'AMBIGUOUS', candidates: fuzzy.map((f) => f.entityId) }
    }
    out.push({ ...it, ...m })
  }
  return out
}
