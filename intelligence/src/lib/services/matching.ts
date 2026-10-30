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
  stripped: Map<string, Set<string>>
}

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
  const add = (key: string, id: string, method: string, confidence: number) => {
    if (!key) return
    const cur = exact.get(key)
    if (!cur || confidence > cur.confidence) exact.set(key, { ids: new Set([id]), method, confidence })
    else if (confidence === cur.confidence) cur.ids.add(id)
    const s = stripParentheticals(key)
    const set = stripped.get(s) ?? new Set<string>()
    set.add(id)
    stripped.set(s, set)
  }
  for (const i of ings) {
    add(normalizeName(i.canonicalName), i.id, 'EXACT_CANONICAL', 1)
    if (i.inciName) add(normalizeName(i.inciName), i.id, 'EXACT_INCI', 1)
    add(normalizeName(i.displayName), i.id, 'EXACT_CANONICAL', 1)
    for (const n of i.names) add(n.normalized, i.id, n.nameType === 'INCI' ? 'EXACT_INCI' : 'EXACT_NAME', n.nameType === 'INCI' ? 1 : 0.95)
    for (const a of i.aliases) add(a.normalized, i.id, a.aliasType === 'LABEL_DISPLAY_NAME' ? 'LABEL_DISPLAY_ALIAS' : 'EXACT_ALIAS', ALIAS_CONFIDENCE[a.aliasType] ?? 0.9)
  }
  return { exact, stripped }
}

/**
 * Matches a displayed label name to a canonical ingredient. Ambiguity is surfaced, never resolved by guessing:
 * multiple candidates or confidence < 0.9 ⇒ AMBIGUOUS and the line goes to identity review.
 */
export function matchName(index: NameIndex, displayed: string): MatchResult {
  const key = normalizeName(displayed)
  const hit = index.exact.get(key)
  if (hit) {
    const ids = [...hit.ids]
    if (ids.length > 1) return { ingredientId: null, confidence: 0.5, method: hit.method, status: 'AMBIGUOUS', candidates: ids }
    return { ingredientId: ids[0], confidence: hit.confidence, method: hit.method, status: hit.confidence >= 0.9 ? 'MATCHED' : 'AMBIGUOUS', candidates: ids }
  }
  const s = index.stripped.get(stripParentheticals(displayed))
  if (s && s.size === 1) return { ingredientId: [...s][0], confidence: 0.85, method: 'PARENTHETICAL_STRIPPED', status: 'AMBIGUOUS', candidates: [...s] }
  if (s && s.size > 1) return { ingredientId: null, confidence: 0.4, method: 'PARENTHETICAL_STRIPPED', status: 'AMBIGUOUS', candidates: [...s] }
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
