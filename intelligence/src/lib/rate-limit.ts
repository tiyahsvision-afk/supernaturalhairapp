// In-memory token bucket. Suitable for a single instance; for multiple instances move buckets to Postgres or Redis
// (documented in docs/architecture.md).
interface Bucket { tokens: number; updated: number }
const buckets = new Map<string, Bucket>()

export function rateLimit(key: string, capacity = 120, refillPerSecond = 2): { ok: boolean; retryAfterSeconds: number } {
  const now = Date.now()
  const b = buckets.get(key) ?? { tokens: capacity, updated: now }
  b.tokens = Math.min(capacity, b.tokens + ((now - b.updated) / 1000) * refillPerSecond)
  b.updated = now
  if (b.tokens < 1) {
    buckets.set(key, b)
    return { ok: false, retryAfterSeconds: Math.ceil((1 - b.tokens) / refillPerSecond) }
  }
  b.tokens -= 1
  buckets.set(key, b)
  return { ok: true, retryAfterSeconds: 0 }
}

export function resetRateLimits() {
  buckets.clear()
}
