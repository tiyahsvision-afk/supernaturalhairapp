import { createHash } from 'node:crypto'
import { Prisma, type ImportKind, type ImportOutcome } from '@prisma/client'
import { prisma } from '../db'
import { audit } from '../audit'
import type { Principal } from '../permissions'
import { parseCsv } from './csv'
import { HANDLERS, type ImportContext } from './handlers'

export const PARSER_VERSIONS: Record<string, string> = {
  ingredient: 'ingredient-import-1.0.0', product: 'product-import-1.0.0', evidence: 'evidence-import-1.0.0',
  patent: 'patent-import-1.0.0', regulatory: 'regulatory-import-1.0.0', fact: 'fact-import-1.0.0',
}

export const MAX_IMPORT_ROWS = 50_000
const CHUNK = 25

export function rowHash(row: unknown): string {
  return createHash('sha256').update(JSON.stringify(row, Object.keys(row as object).sort())).digest('hex')
}

/**
 * Data-rights gate for imports. Blocked: PROHIBITED/UNKNOWN rights, no storage permission, and RESTRICTED sources
 * other than internal or consent-governed (Hair Passport) ones.
 */
export function importBlockedReason(source: { rightsStatus: string; storagePermission: boolean; type: string }): string | null {
  if (['PROHIBITED', 'UNKNOWN'].includes(source.rightsStatus)) return `Source rights status is ${source.rightsStatus.toLowerCase()}; imports are blocked until a rights review approves the source.`
  if (!source.storagePermission) return 'Source terms do not permit storing its records.'
  if (source.rightsStatus === 'RESTRICTED' && !['INTERNAL', 'HAIR_PASSPORT'].includes(source.type)) return 'Source is restricted; imports are blocked until a rights review approves them.'
  return null
}

export async function createImportJob(actor: Principal | null, input: { sourceId: string; kind: ImportKind; entityType: string; filename?: string; content: string; sourceVersion?: string }) {
  if (!HANDLERS[input.entityType]) throw new Error(`Unsupported entity type: ${input.entityType}`)
  const blocked = importBlockedReason(await prisma.source.findUniqueOrThrow({ where: { id: input.sourceId } }))
  if (blocked) throw new Error(blocked)
  let rows: Record<string, unknown>[]
  try {
    rows = input.kind === 'CSV' ? parseCsv(input.content) : (() => {
      const parsed = JSON.parse(input.content)
      return Array.isArray(parsed) ? parsed : Array.isArray(parsed.rows) ? parsed.rows : (() => { throw new Error('JSON must be an array or { "rows": [...] }') })()
    })()
  } catch (e) {
    throw new Error(`Could not parse ${input.kind}: ${(e as Error).message}`)
  }
  if (rows.length > MAX_IMPORT_ROWS) throw new Error(`Too many rows (${rows.length}); split the file (max ${MAX_IMPORT_ROWS}).`)
  const job = await prisma.importJob.create({
    data: {
      sourceId: input.sourceId, kind: input.kind, entityType: input.entityType, filename: input.filename, sourceVersion: input.sourceVersion,
      fileSha256: createHash('sha256').update(input.content).digest('hex'), parserVersion: PARSER_VERSIONS[input.entityType] ?? 'unknown',
      totalCount: rows.length, rows: rows as Prisma.InputJsonValue, createdById: actor?.kind === 'USER' ? actor.id : null,
    },
  })
  await audit(actor, { action: 'import.create', entityType: 'ImportJob', entityId: job.id, after: { entityType: input.entityType, rows: rows.length, filename: input.filename }, sourceId: input.sourceId })
  return job
}

const COUNTER: Record<ImportOutcome, keyof Prisma.ImportJobUpdateInput> = {
  CREATED: 'createdCount', UPDATED: 'updatedCount', UNCHANGED: 'unchangedCount', DUPLICATE: 'duplicateCount', REJECTED: 'rejectedCount', QUARANTINED: 'unresolvedCount', WARNING: 'warningCount',
}

/**
 * Runs (or resumes) a job from its cursor. Row failures are recorded as REJECTED and do not abort the job.
 * A crash leaves status FAILED with the cursor at the last committed chunk, so re-running resumes without duplicates.
 */
export async function runImportJob(jobId: string, actor: Principal | null) {
  const job = await prisma.importJob.findUniqueOrThrow({ where: { id: jobId } })
  if (job.status === 'COMPLETED' || job.status === 'PARTIAL') return job
  const rows = (job.rows as Record<string, unknown>[] | null) ?? []
  const started = Date.now()
  await prisma.importJob.update({ where: { id: jobId }, data: { status: 'RUNNING', startedAt: job.startedAt ?? new Date() } })
  await prisma.source.update({ where: { id: job.sourceId }, data: { lastAttemptedImportAt: new Date() } })
  const ctx: ImportContext = { actor, jobId, sourceId: job.sourceId, cache: new Map() }
  const handler = HANDLERS[job.entityType]
  const errors = (job.errors as { row: number; message: string }[]) ?? []
  try {
    for (let i = job.cursor; i < rows.length; i += CHUNK) {
      const chunk = rows.slice(i, i + CHUNK)
      const counts: Partial<Record<ImportOutcome, number>> = {}
      for (let j = 0; j < chunk.length; j++) {
        const rowNumber = i + j + 1
        let res: { outcome: ImportOutcome; entityId?: string; externalKey?: string; message?: string }
        try {
          res = await handler(chunk[j], ctx, rowHash(chunk[j]))
        } catch (e) {
          res = { outcome: 'REJECTED', message: (e as Error).message.slice(0, 500) }
          errors.push({ row: rowNumber, message: res.message! })
        }
        counts[res.outcome] = (counts[res.outcome] ?? 0) + 1
        await prisma.importRecord.create({ data: { jobId, rowNumber, outcome: res.outcome, externalKey: res.externalKey, entityType: job.entityType, entityId: res.entityId, message: res.message } })
      }
      const inc: Prisma.ImportJobUpdateInput = { cursor: i + chunk.length, processedCount: { increment: chunk.length }, errors: errors.slice(-200) }
      for (const [k, v] of Object.entries(counts)) (inc as Record<string, unknown>)[COUNTER[k as ImportOutcome]] = { increment: v }
      await prisma.importJob.update({ where: { id: jobId }, data: inc })
    }
    const done = await prisma.importJob.findUniqueOrThrow({ where: { id: jobId } })
    const status = done.rejectedCount > 0 ? 'PARTIAL' : 'COMPLETED'
    const finished = await prisma.importJob.update({ where: { id: jobId }, data: { status, finishedAt: new Date(), durationMs: Date.now() - started + (job.durationMs ?? 0), rows: Prisma.DbNull } })
    await prisma.source.update({ where: { id: job.sourceId }, data: { lastSuccessfulImportAt: new Date(), parserVersion: job.parserVersion, recordCount: { increment: done.createdCount }, errorCount: { increment: done.rejectedCount } } })
    await audit(actor, { action: 'import.finish', entityType: 'ImportJob', entityId: jobId, after: { status, created: done.createdCount, updated: done.updatedCount, unchanged: done.unchangedCount, rejected: done.rejectedCount, duplicates: done.duplicateCount, unresolved: done.unresolvedCount } })
    return finished
  } catch (e) {
    errors.push({ row: -1, message: `Job failed: ${(e as Error).message}` })
    return prisma.importJob.update({ where: { id: jobId }, data: { status: 'FAILED', errors, durationMs: Date.now() - started } })
  }
}

/** Fire-and-forget runner for web requests: the request returns immediately; the page polls job status. */
export function startImportInBackground(jobId: string, actor: Principal | null) {
  void runImportJob(jobId, actor).catch(async (e) => {
    await prisma.importJob.update({ where: { id: jobId }, data: { status: 'FAILED', errors: [{ row: -1, message: String(e) }] } }).catch(() => undefined)
  })
}
