import type { Prisma } from '@prisma/client'
import { prisma } from './db'
import type { Principal } from './permissions'

type Tx = Prisma.TransactionClient | typeof prisma

export interface AuditInput {
  action: string
  entityType: string
  entityId: string
  before?: unknown
  after?: unknown
  reason?: string
  sourceId?: string | null
  requestId?: string
  ip?: string
}

function toJson(v: unknown): Prisma.InputJsonValue | undefined {
  if (v === undefined || v === null) return undefined
  // Decimal/Date/BigInt safe serialization.
  return JSON.parse(JSON.stringify(v, (_k, val) => (typeof val === 'bigint' ? val.toString() : val)))
}

/** Writes an append-only audit row. Pass the transaction client so the audit commits atomically with the change. */
export async function audit(actor: Principal | null, input: AuditInput, tx: Tx = prisma) {
  await tx.auditLog.create({
    data: {
      actorId: actor?.kind === 'USER' ? actor.id : null,
      actorType: actor ? actor.kind : 'SYSTEM',
      actorLabel: actor?.label ?? 'system',
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId,
      before: toJson(input.before),
      after: toJson(input.after),
      reason: input.reason,
      sourceId: input.sourceId ?? null,
      requestId: input.requestId,
      ip: input.ip,
    },
  })
}

export async function securityEvent(type: string, details: { userId?: string; email?: string; ip?: string; [k: string]: unknown }) {
  const { userId, email, ip, ...rest } = details
  await prisma.securityEvent.create({ data: { type, userId, email, ip, details: toJson(rest) ?? {} } })
}
