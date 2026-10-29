// Regulatory records are jurisdiction- and time-specific. A record is stale when it has never been checked against its
// source or when its last check is older than staleAfterDays.
export function isStale(r: { lastCheckedAt: Date | null; staleAfterDays: number }, now = new Date()): boolean {
  if (!r.lastCheckedAt) return true
  return now.getTime() - r.lastCheckedAt.getTime() > r.staleAfterDays * 86400_000
}

export const JURISDICTIONS: Record<string, string> = { US: 'United States', EU: 'European Union', UK: 'United Kingdom', CA: 'Canada' }

export const REGULATORY_DISCLAIMER =
  'Regulatory information is jurisdiction-specific and time-specific. Presence in this database does not mean an ingredient is approved or safe for every use. U.S. cosmetic ingredients generally do not receive FDA premarket approval (color additives are an exception). Qualified regulatory review is required before any commercial formulation decision.'
