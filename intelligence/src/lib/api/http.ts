import { NextResponse } from 'next/server'
import { ZodError } from 'zod'
import { prisma } from '../db'
import { resolveApiKey } from '../auth/api-keys'
import { resolveSession, SESSION_COOKIE } from '../auth/session'
import { can, type Permission, type Principal } from '../permissions'
import { rateLimit } from '../rate-limit'
import { securityEvent } from '../audit'

export class ApiError extends Error {
  constructor(public status: number, public code: string, message: string, public details?: unknown) { super(message) }
}

export function json(data: unknown, init?: number | ResponseInit) {
  return NextResponse.json(data, typeof init === 'number' ? { status: init } : init)
}

function errorResponse(status: number, code: string, message: string, details?: unknown, headers?: Record<string, string>) {
  return NextResponse.json({ error: { code, message, ...(details !== undefined ? { details } : {}) } }, { status, headers })
}

export interface ApiContext { principal: Principal; external: boolean; req: Request }

async function authenticate(req: Request): Promise<Principal | null> {
  const auth = req.headers.get('authorization')
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
  if (auth?.startsWith('Bearer ')) return resolveApiKey(auth.slice(7).trim(), ip)
  const cookie = req.headers.get('cookie')?.split(/;\s*/).find((c) => c.startsWith(`${SESSION_COOKIE}=`))
  const s = await resolveSession(cookie ? decodeURIComponent(cookie.slice(SESSION_COOKIE.length + 1)) : null)
  if (!s || !s.mfaVerified || s.needsMfaEnrollment) return null
  // Cookie-authenticated writes must come from our own origin (CSRF protection).
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    const origin = req.headers.get('origin')
    if (!origin || new URL(origin).host !== new URL(req.url).host) throw new ApiError(403, 'CSRF', 'Cross-origin request rejected.')
  }
  return s.principal
}

/** Wraps a route: authentication, permission, rate limiting, structured errors. */
export function route(perm: Permission | null, fn: (ctx: ApiContext, params: Record<string, string>) => Promise<Response>) {
  return async (req: Request, context: { params: Promise<Record<string, string>> }) => {
    try {
      const principal = await authenticate(req)
      if (!principal) return errorResponse(401, 'UNAUTHENTICATED', 'Provide a valid API key (Authorization: Bearer …) or a signed-in session.')
      const rl = rateLimit(`api:${principal.kind}:${principal.id}`)
      if (!rl.ok) {
        await securityEvent('RATE_LIMITED', { userId: principal.kind === 'USER' ? principal.id : undefined, key: principal.label })
        return errorResponse(429, 'RATE_LIMITED', 'Too many requests.', undefined, { 'Retry-After': String(rl.retryAfterSeconds) })
      }
      if (perm && !can(principal, perm)) {
        await securityEvent('PERMISSION_DENIED', { userId: principal.kind === 'USER' ? principal.id : undefined, permission: perm, path: new URL(req.url).pathname, key: principal.label })
        return errorResponse(403, 'FORBIDDEN', `Requires scope/permission: ${perm}`)
      }
      const org = await prisma.organization.findUnique({ where: { id: principal.organizationId } })
      const external = principal.kind === 'API_KEY' && org?.type !== 'INTERNAL'
      return await fn({ principal, external, req }, await context.params)
    } catch (e) {
      if (e instanceof ApiError) return errorResponse(e.status, e.code, e.message, e.details)
      if (e instanceof ZodError) return errorResponse(422, 'VALIDATION_FAILED', 'Request body is invalid.', e.issues.map((i) => ({ path: i.path.join('.'), message: i.message })))
      if (e instanceof SyntaxError) return errorResponse(400, 'BAD_JSON', 'Body is not valid JSON.')
      if ((e as { code?: string }).code === 'P2025') return errorResponse(404, 'NOT_FOUND', 'Record not found.')
      console.error(e)
      return errorResponse(500, 'INTERNAL', 'Unexpected error. The incident has been logged.')
    }
  }
}

export function pageParams(req: Request) {
  const u = new URL(req.url)
  const limit = Math.min(100, Math.max(1, Number(u.searchParams.get('limit') ?? 25) || 25))
  const cursor = u.searchParams.get('cursor') ?? undefined
  return { limit, cursor, url: u }
}

/** Prisma cursor pagination helper: fetches limit+1 rows to compute nextCursor. */
export function paginate<T extends { id: string }>(rows: T[], limit: number) {
  const nextCursor = rows.length > limit ? rows[limit - 1].id : null
  return { data: rows.slice(0, limit), nextCursor }
}

/**
 * Data-rights gate. External (partner-organization) API keys only receive records whose source allows external API
 * use; internal callers receive records whose source is not prohibited/restricted/unknown.
 */
export async function allowedSourceIds(ctx: ApiContext): Promise<Set<string>> {
  const sources = await prisma.source.findMany({ select: { id: true, allowExternalApi: true, rightsStatus: true } })
  return new Set(sources.filter((s) => (ctx.external ? s.allowExternalApi : !['PROHIBITED', 'UNKNOWN'].includes(s.rightsStatus))).map((s) => s.id))
}

export function withhold<T extends { sourceId: string | null }>(rows: T[], allowed: Set<string>) {
  const kept = rows.filter((r) => !r.sourceId || allowed.has(r.sourceId))
  return { kept, withheld: rows.length - kept.length }
}
