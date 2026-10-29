import { Prisma } from '@prisma/client'
import { prisma } from './db'
import { detectIdentifier, normalizeIdentifier, normalizeName } from './normalize'
import { can, type Principal } from './permissions'

export interface SearchHit {
  entityType: string
  entityId: string
  label: string
  detail: string | null
  matchedTerm: string
  termKind: string
  tier: number
  score: number
  why: string
}

export const ENTITY_PERMS: Record<string, Parameters<typeof can>[1]> = {
  ingredient: 'ingredient:read',
  product: 'product:read',
  patent: 'patent:read',
  evidence: 'evidence:read',
  supplier: 'supplier:read',
  raw_material: 'rawmaterial:read',
  formula: 'formula:read',
  research_candidate: 'ip:read',
}

const KIND_LABEL: Record<string, string> = {
  CANONICAL: 'canonical name', INCI: 'INCI name', IDENTIFIER: 'identifier', ALIAS: 'synonym', MISSPELLING: 'known misspelling',
  NAME: 'name', TITLE: 'title', BRAND: 'brand', CODE: 'code', FUNCTION: 'function', TEXT: 'text',
}

const TIER_LABEL: Record<number, string> = { 1: 'Exact', 2: 'Exact identifier', 3: 'Exact', 4: 'Prefix', 5: 'Fuzzy', 6: 'Contains' }

function explain(tier: number, kind: string, term: string): string {
  return `${TIER_LABEL[tier] ?? 'Match'} — matched ${KIND_LABEL[kind] ?? kind.toLowerCase()}: ${term}`
}

/**
 * Ranked search. Ranking (never overridden by fuzzy/semantic relevance):
 *  1 exact canonical/INCI/title/code · 2 exact identifier · 3 exact alias/name · 4 prefix · 5 fuzzy (trigram) · 6 substring.
 * Private entity types are filtered by organization + visibility before results leave the database.
 */
export async function search(principal: Principal, rawQuery: string, opts: { types?: string[]; limit?: number } = {}): Promise<{ hits: SearchHit[]; suggestions: string[]; durationMs: number }> {
  const started = Date.now()
  const limit = Math.min(opts.limit ?? 30, 100)
  const idKind = detectIdentifier(rawQuery)
  const q = idKind ? normalizeIdentifier(idKind, rawQuery).toLowerCase() : normalizeName(rawQuery)
  if (!q) return { hits: [], suggestions: [], durationMs: 0 }

  const allowedTypes = Object.keys(ENTITY_PERMS).filter((t) => can(principal, ENTITY_PERMS[t]) && (!opts.types?.length || opts.types.includes(t)))
  if (!allowedTypes.length) return { hits: [], suggestions: [], durationMs: Date.now() - started }

  const privateVis: string[] = ['ORGANIZATION']
  if (can(principal, 'formula:private:read') || can(principal, 'rawmaterial:read')) privateVis.push('RESTRICTED')
  if (can(principal, 'ip:read')) privateVis.push('CONFIDENTIAL_IP')

  const rows = await prisma.$queryRaw<{ entityType: string; entityId: string; label: string; detail: string | null; term: string; termKind: string; tier: number; sim: number; weight: number }[]>`
    WITH scored AS (
      SELECT "entityType", "entityId", label, detail, term, "termKind", weight,
        similarity(normalized, ${q}) AS sim,
        CASE
          WHEN normalized = ${q} AND "termKind" IN ('CANONICAL','INCI','TITLE','CODE') THEN 1
          WHEN normalized = ${q} AND "termKind" = 'IDENTIFIER' THEN 2
          WHEN normalized = ${q} THEN 3
          WHEN normalized LIKE ${q + '%'} THEN 4
          WHEN normalized % ${q} THEN 5
          WHEN length(${q}) >= 3 AND normalized LIKE ${'%' + q + '%'} THEN 6
          ELSE NULL END AS tier
      FROM "SearchEntry"
      WHERE "entityType" IN (${Prisma.join(allowedTypes)})
        AND (visibility IS NULL OR visibility = 'SHARED'
             OR ("ownerOrgId" = ${principal.organizationId}::uuid AND visibility::text IN (${Prisma.join(privateVis)})))
        AND (normalized = ${q} OR normalized LIKE ${q + '%'} OR normalized % ${q} OR (length(${q}) >= 3 AND normalized LIKE ${'%' + q + '%'}))
    ), best AS (
      SELECT DISTINCT ON ("entityType", "entityId") * FROM scored WHERE tier IS NOT NULL
      ORDER BY "entityType", "entityId", tier ASC, sim DESC, weight DESC
    )
    SELECT * FROM best ORDER BY tier ASC, sim DESC, weight DESC, label ASC LIMIT ${limit}`

  const hits: SearchHit[] = rows.map((r) => ({
    entityType: r.entityType, entityId: r.entityId, label: r.label, detail: r.detail, matchedTerm: r.term, termKind: r.termKind,
    tier: Number(r.tier), score: Number(r.sim), why: explain(Number(r.tier), r.termKind, r.term),
  }))

  let suggestions: string[] = []
  if (hits.length === 0) {
    const sug = await prisma.$queryRaw<{ label: string }[]>`
      SELECT DISTINCT ON (label) label, similarity(normalized, ${q}) AS sim FROM "SearchEntry"
      WHERE "entityType" = 'ingredient' AND similarity(normalized, ${q}) > 0.15
      ORDER BY label, sim DESC LIMIT 20`
    suggestions = sug.map((s) => s.label).slice(0, 5)
  }
  return { hits, suggestions, durationMs: Date.now() - started }
}

export async function logSearch(userId: string | null, query: string, filters: object, resultCount: number, durationMs: number) {
  await prisma.searchLog.create({ data: { userId, query: query.slice(0, 300), filters: filters as Prisma.InputJsonValue, resultCount, durationMs, zeroResult: resultCount === 0 } })
}
